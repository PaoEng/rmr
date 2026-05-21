#!/usr/bin/env bash
set -euo pipefail

COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"

rm -rf "$COPILOT_HOME/extensions/rmr" "$COPILOT_HOME/skills/rmr"
printf 'rmr rimosso da %s\n' "$COPILOT_HOME"

