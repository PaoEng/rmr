import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession } from "@github/copilot-sdk/extension";

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const PRESETS_PATH = join(EXTENSION_DIR, "presets.json");
const EVIDENCE_FILE_NAME = "rmr-evidence.jsonl";
const PRIMARY_TOOL_NAME = "rmr";
const SWITCH_COMMAND = "rmr-model";
const BACKGROUND_COMMAND = "rmr-bg";
const STATUS_COMMAND = "rmr-status";

let session;

function normalizePresetKey(value) {
    return String(value || "").trim().toLowerCase();
}

function requireNonEmpty(value, label) {
    const normalized = String(value || "").trim();
    if (!normalized) {
        throw new Error(`${label} obbligatorio.`);
    }

    return normalized;
}

function parseSpaceSeparatedArgs(rawArgs) {
    const input = String(rawArgs || "").trim();
    if (!input) {
        return [];
    }

    const result = [];
    let current = "";
    let quote = null;
    let escaped = false;

    for (const char of input) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current) {
                result.push(current);
                current = "";
            }
            continue;
        }

        current += char;
    }

    if (current) {
        result.push(current);
    }

    return result;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toTimestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        return numeric;
    }

    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildTaskName(presetKey, agentType, prompt) {
    const promptLabel =
        String(prompt || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 32) || "task";

    return `${presetKey}-${agentType}-${promptLabel}`.slice(0, 80);
}

async function readPresets() {
    const raw = await readFile(PRESETS_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`File preset non valido: ${PRESETS_PATH}`);
    }

    const presets = {};

    for (const [key, value] of Object.entries(parsed)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error(`Preset non valido per chiave '${key}'.`);
        }

        if (typeof value.model !== "string" || !value.model.trim()) {
            throw new Error(`Il preset '${key}' deve avere una proprieta' 'model' valida.`);
        }

        presets[normalizePresetKey(key)] = {
            model: value.model.trim(),
            description: typeof value.description === "string" ? value.description.trim() : "",
            reasoningEffort:
                typeof value.reasoningEffort === "string" && value.reasoningEffort.trim()
                    ? value.reasoningEffort.trim()
                    : undefined,
        };
    }

    if (Object.keys(presets).length === 0) {
        throw new Error(`Nessun preset definito in ${PRESETS_PATH}.`);
    }

    return presets;
}

function resolvePreset(presets, presetKey) {
    const normalizedKey = normalizePresetKey(presetKey);
    const preset = presets[normalizedKey];

    if (!preset) {
        const available = Object.keys(presets).sort().join(", ");
        throw new Error(`Preset sconosciuto: '${presetKey}'. Disponibili: ${available}`);
    }

    return {
        key: normalizedKey,
        ...preset,
    };
}

function renderPresetList(presets) {
    return Object.entries(presets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => {
            const suffix = value.description ? ` - ${value.description}` : "";
            return `- ${key} -> ${value.model}${suffix}`;
        })
        .join("\n");
}

function createModelSwitchOptions(preset) {
    if (!preset.reasoningEffort) {
        return undefined;
    }

    return {
        reasoningEffort: preset.reasoningEffort,
    };
}

async function getEvidencePath() {
    if (!session.workspacePath) {
        return null;
    }

    const evidenceDir = join(session.workspacePath, "files");
    await mkdir(evidenceDir, { recursive: true });
    return join(evidenceDir, EVIDENCE_FILE_NAME);
}

async function appendEvidence(kind, payload) {
    const evidencePath = await getEvidencePath();
    if (!evidencePath) {
        return null;
    }

    const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        kind,
        ...payload,
    });

    await appendFile(evidencePath, `${line}\n`, "utf8");
    return evidencePath;
}

function renderEvidenceLine(evidencePath) {
    return evidencePath ? `Evidence: ${evidencePath}` : null;
}

async function getCurrentModelId() {
    const currentModel = await session.rpc.model.getCurrent();
    return currentModel.modelId || "unknown";
}

async function waitForAgentTask(agentId, attempts = 20, delayMs = 500) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const taskList = await session.rpc.tasks.list();
        const task = (taskList.tasks || []).find((candidate) => candidate.id === agentId);

        if (task) {
            return task;
        }

        await sleep(delayMs);
    }

    return null;
}

async function listRecentAgentTasks(limit = 5) {
    const taskList = await session.rpc.tasks.list();

    return (taskList.tasks || [])
        .filter((task) => task.type === "agent")
        .sort((left, right) => toTimestamp(right.startedAt) - toTimestamp(left.startedAt))
        .slice(0, limit);
}

function formatRecentTask(task) {
    const model = task.model || "n/d";
    const status = task.status || "unknown";
    const description = task.description ? ` | ${task.description}` : "";
    return `- ${task.id} | ${task.agentType} | ${status} | ${model}${description}`;
}

function resolveOverrideStatus(observedTask, requestedModel) {
    if (!observedTask) {
        return {
            matchedRequestedModel: null,
            overrideStatus: "pending_task_visibility",
            overrideLabel: "in attesa (task non ancora visibile)",
        };
    }

    if (observedTask.model === requestedModel) {
        return {
            matchedRequestedModel: true,
            overrideStatus: "confirmed",
            overrideLabel: "si",
        };
    }

    return {
        matchedRequestedModel: false,
        overrideStatus: "mismatch",
        overrideLabel: "no (modello diverso)",
    };
}

async function showStatus(source, entrypoint) {
    const presets = await readPresets();
    const currentModel = await getCurrentModelId();
    const recentTasks = await listRecentAgentTasks();
    const evidencePath = await getEvidencePath();

    const lines = [
        `Modello attuale: ${currentModel}`,
        "Preset disponibili:",
        renderPresetList(presets),
    ];

    if (recentTasks.length > 0) {
        lines.push("Background task recenti:");
        lines.push(recentTasks.map((task) => formatRecentTask(task)).join("\n"));
    } else {
        lines.push("Background task recenti: nessuno");
    }

    const evidenceLine = renderEvidenceLine(evidencePath);
    if (evidenceLine) {
        lines.push(evidenceLine);
    }

    await appendEvidence("show_status", {
        source,
        entrypoint: entrypoint || null,
        currentModel,
        recentTasks: recentTasks.map((task) => ({
            id: task.id,
            agentType: task.agentType,
            status: task.status,
            model: task.model || null,
        })),
    });

    return lines.join("\n");
}

async function switchModelWithPreset(presetKey, source, entrypoint) {
    const presets = await readPresets();
    const preset = resolvePreset(presets, presetKey);
    const beforeModel = await getCurrentModelId();

    await session.setModel(preset.model, createModelSwitchOptions(preset));

    const evidencePath = await appendEvidence("switch_model_request", {
        source,
        entrypoint: entrypoint || null,
        preset: preset.key,
        requestedModel: preset.model,
        beforeModel,
    });

    const lines = [
        `Preset richiesto: ${preset.key}`,
        `Modello corrente prima della richiesta: ${beforeModel}`,
        `Modello richiesto per il prossimo messaggio: ${preset.model}`,
        "Nota: il cambio modello diventa effettivo dal messaggio successivo.",
        "Verifica con /rmr-status oppure con il prompt seguente nella stessa sessione.",
    ];

    const evidenceLine = renderEvidenceLine(evidencePath);
    if (evidenceLine) {
        lines.push(evidenceLine);
    }

    await session.log(
        `rmr: richiesta cambio preset '${preset.key}' -> ${preset.model} (prima: ${beforeModel})`
    );

    return lines.join("\n");
}

async function startBackgroundTaskWithPreset({
    presetKey,
    agentType,
    prompt,
    taskName,
    taskDescription,
    source,
    entrypoint,
}) {
    const resolvedAgentType = requireNonEmpty(agentType, "agentType");
    const resolvedPrompt = requireNonEmpty(prompt, "prompt");
    const presets = await readPresets();
    const preset = resolvePreset(presets, presetKey);
    const beforeModel = await getCurrentModelId();
    const resolvedTaskName = taskName || buildTaskName(preset.key, resolvedAgentType, resolvedPrompt);
    const resolvedTaskDescription =
        taskDescription || `Preset ${preset.key} -> ${preset.model}`;

    const startResult = await session.rpc.tasks.startAgent({
        agentType: resolvedAgentType,
        prompt: resolvedPrompt,
        name: resolvedTaskName,
        description: resolvedTaskDescription,
        model: preset.model,
    });

    const observedTask = await waitForAgentTask(startResult.agentId);
    const overrideResult = resolveOverrideStatus(observedTask, preset.model);
    const observedModel = observedTask?.model || "n/d";
    const observedStatus = observedTask?.status || "not_yet_visible";
    const executionMode = observedTask?.executionMode || "n/d";

    const evidencePath = await appendEvidence("start_background_task", {
        source,
        entrypoint: entrypoint || null,
        preset: preset.key,
        requestedModel: preset.model,
        beforeModel,
        agentId: startResult.agentId,
        agentType: resolvedAgentType,
        prompt: resolvedPrompt,
        taskName: resolvedTaskName,
        taskDescription: resolvedTaskDescription,
        observedModel: observedTask?.model || null,
        observedStatus,
        executionMode,
        matchedRequestedModel: overrideResult.matchedRequestedModel,
        overrideStatus: overrideResult.overrideStatus,
    });

    const lines = [
        `Background task avviato: ${startResult.agentId}`,
        `Preset: ${preset.key}`,
        `Modello richiesto: ${preset.model}`,
        `Modello sessione corrente: ${beforeModel}`,
        `Agent type: ${resolvedAgentType}`,
        `Task name: ${resolvedTaskName}`,
        `Task status osservato: ${observedStatus}`,
        `Task model osservato: ${observedModel}`,
        `Override confermato: ${overrideResult.overrideLabel}`,
        `Execution mode: ${executionMode}`,
    ];

    const evidenceLine = renderEvidenceLine(evidencePath);
    if (evidenceLine) {
        lines.push(evidenceLine);
    }

    await session.log(
        `rmr: background '${startResult.agentId}' richiesto con preset '${preset.key}' -> ${preset.model}`
    );

    return lines.join("\n");
}

async function withCommandHandling(commandName, action) {
    try {
        await action();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await session.log(`rmr (${commandName}): ${message}`, {
            level: "error",
        });
        throw error;
    }
}

function toolFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        textResultForLlm: `rmr error: ${message}`,
        resultType: "failure",
    };
}

function createCommandDefinition(name, description, handler) {
    return {
        name,
        description,
        handler: async (context) =>
            withCommandHandling(name, async () => {
                await handler(context);
            }),
    };
}

function createSwitchCommand(name) {
    return createCommandDefinition(
        name,
        "Switch the active Copilot CLI model using a preset.",
        async (context) => {
            const presetKey = requireNonEmpty(context.args, "preset");
            const text = await switchModelWithPreset(presetKey, "command", name);
            await session.log(text);
        }
    );
}

function createBackgroundCommand(name) {
    return createCommandDefinition(
        name,
        `Start a background agent with a preset model. Usage: /${name} <preset> <agentType> <prompt>`,
        async (context) => {
            const parts = parseSpaceSeparatedArgs(context.args);
            if (parts.length < 3) {
                const presets = await readPresets();
                await session.log(
                    [
                        `Uso: /${name} <preset> <agentType> <prompt>`,
                        "Preset disponibili:",
                        renderPresetList(presets),
                    ].join("\n"),
                    { level: "warning" }
                );
                return;
            }

            const [presetKey, agentType, ...promptParts] = parts;
            const text = await startBackgroundTaskWithPreset({
                presetKey,
                agentType,
                prompt: promptParts.join(" "),
                source: "command",
                entrypoint: name,
            });
            await session.log(text);
        }
    );
}

function createStatusCommand(name) {
    return createCommandDefinition(
        name,
        "Show the current model, preset mappings, and recent background task metadata.",
        async () => {
            const text = await showStatus("command", name);
            await session.log(text);
        }
    );
}

function createToolDefinition(name) {
    return {
        name,
        description:
            name === PRIMARY_TOOL_NAME
                ? "Switch the current Copilot CLI model with a preset, inspect routing status, or start a background task with a preset model."
                : "Compatibility alias for rmr.",
        skipPermission: true,
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["switch_model", "show_status", "start_background_task"],
                    description: "Operation to execute.",
                },
                preset: {
                    type: "string",
                    description: "Preset name. Valid values come from presets.json, for example code, review, script.",
                },
                agentType: {
                    type: "string",
                    description: "Background agent type, for example rubber-duck, general-purpose, task, explore.",
                },
                prompt: {
                    type: "string",
                    description: "Prompt to send to the background agent.",
                },
                taskName: {
                    type: "string",
                    description: "Optional stable name for the background task.",
                },
                taskDescription: {
                    type: "string",
                    description: "Optional description for the background task.",
                },
            },
            required: ["action"],
        },
        handler: async (args, invocation) => {
            try {
                switch (args.action) {
                    case "switch_model":
                        return await switchModelWithPreset(
                            requireNonEmpty(args.preset, "preset"),
                            "tool",
                            invocation?.toolName || name
                        );
                    case "show_status":
                        return await showStatus("tool", invocation?.toolName || name);
                    case "start_background_task":
                        return await startBackgroundTaskWithPreset({
                            presetKey: requireNonEmpty(args.preset, "preset"),
                            agentType: requireNonEmpty(args.agentType, "agentType"),
                            prompt: requireNonEmpty(args.prompt, "prompt"),
                            taskName: args.taskName ? String(args.taskName).trim() : undefined,
                            taskDescription: args.taskDescription
                                ? String(args.taskDescription).trim()
                                : undefined,
                            source: "tool",
                            entrypoint: invocation?.toolName || name,
                        });
                    default:
                        throw new Error(`Azione non supportata: ${String(args.action)}`);
                }
            } catch (error) {
                const failure = toolFailure(error);
                await session.log(failure.textResultForLlm, { level: "error" });
                return failure;
            }
        },
    };
}

function buildCommandDefinitions() {
    return [
        createSwitchCommand(SWITCH_COMMAND),
        createBackgroundCommand(BACKGROUND_COMMAND),
        createStatusCommand(STATUS_COMMAND),
    ];
}

session = await joinSession({
    commands: buildCommandDefinitions(),
    tools: [createToolDefinition(PRIMARY_TOOL_NAME)],
});

const startupPresets = await readPresets();
await session.log(
    `rmr loaded. Preset disponibili: ${Object.keys(startupPresets).sort().join(", ")}`
);
