# Uso

## Comandi principali

- `/rmr-model <preset>`: cambia il modello attivo della sessione;
- `/rmr-bg <preset> <agentType> <prompt>`: avvia un background task con il modello del preset;
- `/rmr-status`: mostra modello corrente, preset e task recenti.

## Preset inclusi

- `code` -> `claude-sonnet-4.6`
- `review` -> `gpt-5.4`
- `script` -> `gpt-5.4-mini`

## Esempi

```text
/rmr-model code
/rmr-status
/rmr-bg review rubber-duck Analizza i cambiamenti e segnala rischi concreti
/rmr-bg script task Scrivi uno script breve per automatizzare il controllo
```

## Note operative

- `session.setModel()` entra in vigore dal messaggio successivo.
- Il background task puo' usare un modello diverso dal modello attivo della sessione.
