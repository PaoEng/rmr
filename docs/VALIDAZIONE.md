# Validazione

## Cosa verificare

1. `/rmr-status` mostra il modello corrente.
2. `/rmr-model script` sposta il modello su `gpt-5.4-mini`.
3. Un successivo `/rmr-status` conferma il nuovo modello.
4. `/rmr-bg review rubber-duck "..."` avvia un task con `gpt-5.4`.
5. `/rmr-model code` riporta il modello a `claude-sonnet-4.6`.

## Criterio di successo

Il cambio modello non deve essere immediato nella stessa risposta; deve diventare visibile dal messaggio successivo, come previsto dall'SDK.

## Segnali attesi

- `Modello attuale: ...`
- `Preset disponibili: code, review, script`
- `Background task recenti: ...`

