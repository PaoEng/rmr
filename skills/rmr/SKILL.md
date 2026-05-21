---
name: rmr
description: Usa i preset di rmr per cambiare il modello Copilot a runtime o avviare background task con il modello corretto.
allowed-tools:
  - rmr
---

Usa il tool `rmr` quando l'utente vuole controllare il modello del CLI con i preset configurati.

Preset disponibili:

- `code` -> `claude-sonnet-4.6`
- `review` -> `gpt-5.4`
- `script` -> `gpt-5.4-mini`

Regole operative:

1. Se l'utente vuole cambiare il modello attivo della sessione, chiama il tool con:
   - `action: "switch_model"`
   - `preset: "code" | "review" | "script"`
2. Se l'utente vuole lanciare un task in background sul modello giusto, chiama il tool con:
   - `action: "start_background_task"`
   - `preset`
   - `agentType`
   - `prompt`
3. Se l'utente chiede lo stato corrente, i preset o i task recenti, chiama il tool con:
   - `action: "show_status"`
4. Non inventare model ID diversi dai preset configurati.
5. Se l'utente vuole controllo manuale, ricorda questi comandi slash:
   - `/rmr-model <preset>`
   - `/rmr-bg <preset> <agentType> <prompt>`
   - `/rmr-status`

Esempi:

- Cambiare la sessione sul preset review:
  - `action: "switch_model", preset: "review"`
- Lanciare una review in background:
  - `action: "start_background_task", preset: "review", agentType: "rubber-duck", prompt: "Analizza i cambiamenti e segnala rischi"`
