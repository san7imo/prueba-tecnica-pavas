# ADR-004: Total de orden calculado en el servidor

## Estado

Aceptado

## Contexto

El total deriva de cantidades y valores unitarios persistidos. Aceptarlo desde el cliente permitiría valores manipulados/obsoletos; el float binario de JavaScript pierde precisión decimal. Además, mutaciones concurrentes pueden sobrescribirse sin coordinación.

## Decisión

El backend es la única autoridad para `WorkOrder.total`. Se persiste para exponerlo consistentemente sin agregar cada fila en todos los listados. Crear/eliminar ítem abre una transacción y bloquea `work_orders` con `SELECT ... FOR UPDATE`; luego recalcula en MySQL:

```text
CAST(COALESCE(SUM(count * unit_value), 0) AS DECIMAL(15,2))
```

El string decimal se persiste sin convertirlo a `Number`. La entrada se valida/normaliza a dos decimales. El literal Sequelize es fijo y acotado porque el ORM no ofrece una abstracción portable para este cast exacto.

## Alternativas consideradas

- **Confiar en frontend:** no es frontera de seguridad/consistencia.
- **Calcular sólo al leer:** encarece listas y deja sin significado el `total` contractual persistido.
- **Incrementar/decrementar:** puede acumular drift y dificulta recuperación.
- **Usar `Number`:** inseguro para dinero.
- **Añadir librería decimal:** innecesaria mientras MySQL calcula exactamente.

## Consecuencias

- ítem y total se confirman o revierten juntos;
- mutaciones concurrentes de una orden se serializan;
- eliminar último ítem deja `0.00`;
- cada mutación agrega los ítems de esa orden, apropiado para el MVP;
- API devuelve totales como strings de dos decimales.
