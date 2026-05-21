#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COPILOT_HOME="${COPILOT_HOME:-$HOME/.copilot}"

EXT_SRC="$ROOT_DIR/.github/extensions/rmr"
SKILL_SRC="$ROOT_DIR/skills/rmr"
EXT_DST="$COPILOT_HOME/extensions/rmr"
SKILL_DST="$COPILOT_HOME/skills/rmr"

mkdir -p "$COPILOT_HOME/extensions" "$COPILOT_HOME/skills"
rm -rf "$EXT_DST" "$SKILL_DST"
cp -R "$EXT_SRC" "$EXT_DST"
cp -R "$SKILL_SRC" "$SKILL_DST"

printf 'rmr installato in %s\n' "$COPILOT_HOME"
printf "%s\n" "Riavvia Copilot CLI oppure usa /clear per ricaricare l'estensione."
