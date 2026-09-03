# ADR-006: Una orden abierta por moto y locking canónico

## Estado

Aprobado — 2026-09-03.

## Contexto

El MVP verifica existencia de la moto pero permite varias órdenes abiertas. Un check seguido de insert sin serialización tiene race condition. Create, close y reopen cambian la pertenencia al conjunto de órdenes abiertas y deben coordinarse con lifecycle y asignación.

La inspección de HITO 0 encontró 20 motos con múltiples órdenes abiertas en el
volumen Docker generado por el seeder. El usuario confirmó que esos datos son
descartables y que la presentación final iniciará desde una base limpia. Para
cualquier base poblada no descartable, elegir automáticamente cuál conservar
seguiría alterando historia sin criterio de negocio.

## Decisión

Usar defensa en profundidad:

1. transacciones con `SELECT ... FOR UPDATE` y orden canónico de locks;
2. revalidación del estado persistido después de bloquear;
3. `open_bike_id` generated stored que devuelve `bike_id` para estados abiertos y `NULL` para cerrados;
4. índice UNIQUE sobre `open_bike_id` como barrera final;
5. mapping uniforme a `409 BIKE_HAS_ACTIVE_WORK_ORDER`.

MySQL permite indexar columnas generated stored y admite múltiples `NULL` en un índice UNIQUE, por lo que existe cero/una abierta y N cerradas ([CREATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/create-table.html), [CREATE INDEX](https://dev.mysql.com/doc/refman/8.4/en/create-index.html)). La DDL específica se ejecutará desde una migración mediante `sequelize.query`, mecanismo soportado por Sequelize 6 ([raw queries](https://sequelize.org/docs/v6/core-concepts/raw-queries/)).

El orden relevante es:

```text
Client(s) asc
→ Bike
→ User(s) asc
→ WorkOrder
→ WorkOrderItem
```

Una prelectura sólo descubre IDs. La autorización ocurre tras locks y relectura.

La migración de HITO 6 ejecuta preflight. Si encuentra duplicados, aborta e
informa `bike_id`/cantidad. Nunca cierra, cancela o elimina automáticamente. En
una base persistente se corrige mediante decisión humana; el volumen demo puede
recrearse desde cero cuando ese sea el flujo explícitamente elegido.

## Alternativas consideradas

- **Check sin lock:** descartado por carrera create/create.
- **Sólo lock de Bike:** protege rutas conocidas, pero no escrituras fuera del service.
- **Sólo UNIQUE generated:** preserva el dato, pero da peor error y no coordina validaciones/audit.
- **Trigger:** oculta lógica y complica migraciones/tests sin aportar frente a generated UNIQUE.
- **Tabla separada de órdenes activas:** duplica estado y exige sincronización.
- **Cerrar duplicados en migración:** descartado por pérdida de intención empresarial.

## Consecuencias

- create/reopen/close quedan serializados por moto;
- la DB impide violaciones incluso si un caller omite el check de servicio;
- la migración no aplicará sobre datos legacy inconsistentes hasta su revisión;
- DDL MySQL requiere cleanup explícito ante fallo parcial;
- todos los servicios que combinen entidades deben respetar el orden de locks;
- deadlock/timeout reconocido se expone como conflicto reintentable, no como éxito ambiguo.
