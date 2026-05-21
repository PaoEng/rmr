# Installazione

## Prerequisiti

- GitHub Copilot CLI installato
- Modelli visibili nel menu `/model`
- Permessi per scrivere in `~/.copilot`

## Installazione user-scoped

```bash
bash scripts/install.sh
```

Lo script copia:

- `.github/extensions/rmr` in `~/.copilot/extensions/rmr`
- `skills/rmr` in `~/.copilot/skills/rmr`

Poi riavvia Copilot CLI oppure usa `/clear`.

## Installazione manuale

Se preferisci copiare a mano:

```bash
mkdir -p ~/.copilot/extensions ~/.copilot/skills
cp -R .github/extensions/rmr ~/.copilot/extensions/rmr
cp -R skills/rmr ~/.copilot/skills/rmr
```

## Verifica rapida

In una sessione Copilot esegui:

```text
/rmr-status
```

Dovresti vedere:

- il modello corrente;
- i preset `code`, `review`, `script`;
- i task recenti.
