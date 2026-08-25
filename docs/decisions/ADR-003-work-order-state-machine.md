# ADR-003: Máquina de estados de órdenes de trabajo

## Estado

Aceptado

## Contexto

Las órdenes siguen un workflow restringido, no actualizaciones arbitrarias. Avance, cancelación, terminalidad, autorización e idempotencia deben coincidir con el historial de Fase 2.

## Decisión

Usar un mapa explícito en una utilidad de dominio independiente de HTTP y Sequelize. `canTransition(fromStatus, toStatus)` sólo acepta aristas del mapa. El service bloquea la orden en una transacción, lee el estado persistido, valida arista y actor, actualiza y agrega exactamente una fila inmutable con estado anterior/nuevo, nota normalizada, usuario autenticado y timestamp.

La creación también es transaccional: orden `RECIBIDA` y evento `NULL -> RECIBIDA` se confirman o revierten juntos. El historial usa `created_at DESC, id DESC`; `id` desempata y forma parte del índice.

`ENTREGADA` y `CANCELADA` son terminales. Mismo estado devuelve 400; estados desconocidos fallan en validación.

## Alternativas consideradas

- **Condicionales dispersos:** permiten drift y dificultan auditoría.
- **Orden numérico de estados:** cancelación/terminalidad son un grafo, no una comparación ordinal.
- **Librería externa:** seis estados y ocho aristas no justifican dependencia.

## Consecuencias

- workflow inspeccionable y comprobable exhaustivamente;
- cada estado/arista nueva requiere cambio explícito y test;
- concurrencia se revalida contra el estado bajo lock;
- intentos inválidos, idempotentes o prohibidos no dejan auditoría;
- no existen update/delete del ledger.
