# rmr - Runtime Model Router

![alt](8ed16ed1-43f5-4ebb-a760-bd3dc0899083.jpg)


Licenza: MIT

**R**untime**M**odel**R**outer e' una estensione per GitHub Copilot CLI che permette di:

- cambiare il modello della sessione a runtime;
- avviare background task con il modello giusto per il tipo di lavoro;
- mantenere una skill di guida e una struttura pronta da pubblicare su GitHub.

## Cosa include

- `.github/extensions/rmr/extension.mjs`
- `.github/extensions/rmr/presets.json`
- `skills/rmr/SKILL.md`
- `scripts/install.sh`
- `scripts/uninstall.sh`
- `docs/`

## Installazione rapida

```bash
bash scripts/install.sh
```

Poi riavvia Copilot CLI oppure usa `/clear` per ricaricare le estensioni.

## Uso rapido

- `/rmr-status`
- `/rmr-model code`
- `/rmr-model review`
- `/rmr-model script`
- `/rmr-bg review rubber-duck "Analizza il router runtime"`

## Documentazione

- `docs/INSTALLAZIONE.md`
- `docs/USO.md`
- `docs/ARCHITETTURA.md`
- `docs/VALIDAZIONE.md`
- `LICENSE`
