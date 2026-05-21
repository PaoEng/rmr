# Architettura

rmr usa un approccio a due livelli:

1. **Extension**: implementa il routing runtime con i preset, i comandi slash e il tool Copilot.
2. **Skill**: fornisce la guida operativa per usare i preset senza ricordare i dettagli tecnici.

## Flusso

1. L'estensione legge `presets.json`.
2. `session.setModel()` cambia il modello della sessione.
3. `session.rpc.tasks.startAgent()` avvia background task con un modello dedicato.
4. Le prove vengono salvate nei file della workspace della sessione quando disponibili.

## Compatibilita'

La distribuzione usa i soli nomi `rmr-*` per evitare ambiguita' e rendere la pubblicazione su GitHub piu' semplice.
