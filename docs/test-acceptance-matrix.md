# Matriz crítica de aceptación

## Propósito

Esta matriz acumula la aceptación de las fases 1 y 2 y de los hitos de productización aprobados. Relaciona cada comportamiento obligatorio o control de riesgo con evidencia concreta. `PASS` significa que el caso nombrado fue recolectado y pasó en la suite completa; no representa un objetivo porcentual de coverage.

Los nombres de archivo se abrevian en las filas cuando el grupo ya fija su suite. El mapeo autoritativo es:

| Grupo de IDs | Archivo principal |
|---|---|
| `P2-AUTH-*` | `backend/tests/auth.integration.test.js` |
| `P2-RBAC-*`, `P2-USER-*` | `backend/tests/rbac.integration.test.js` |
| `P1-BE-001` a `P1-BE-006`, `P1-DATA-003*` | `backend/tests/clientsBikes.integration.test.js`, `schema.integration.test.js` |
| `P1-BE-007` a `P1-BE-014` | `backend/tests/workOrders.integration.test.js` |
| `P1-STATE-*` | `backend/tests/workOrderStatus.integration.test.js` |
| `P2-AUDIT-*` | `backend/tests/workOrderHistory.integration.test.js`, `schema.integration.test.js` |
| `PZ-AUDIT-*` | `backend/tests/audit.integration.test.js`, `auditSnapshots.test.js` |
| `PZ-CLIENT-*` | `backend/tests/clientLifecycle.integration.test.js`, `clientContactMigration.integration.test.js` |
| `PZ-BIKE-*` | `backend/tests/bikeLifecycle.integration.test.js`, `clientsBikes.integration.test.js` |
| `PZ-OPEN-*` | `backend/tests/workOrders.integration.test.js`, `singleOpenOrderMigration.integration.test.js`, `workOrderStatus.integration.test.js` |
| `PZ-ASSIGN-*` | `backend/tests/workOrderAssignment.integration.test.js` |
| `PZ-NEW-*` | `frontend/tests/NewWorkOrderPage.test.jsx`, `App.test.jsx` |
| `PZ-OWN-001` a `PZ-OWN-007` | `backend/tests/workOrderOwnership.integration.test.js` |
| `PZ-OWN-008` a `PZ-OWN-010` | `frontend/tests/WorkOrdersPage.test.jsx`, `WorkOrderDetailPage.test.jsx`, `App.test.jsx` |
| `PZ-STATE-001` a `PZ-STATE-007` | `backend/tests/workOrderStatus.integration.test.js` |
| `PZ-STATE-008` a `PZ-STATE-009` | `frontend/tests/WorkOrderDetailPage.test.jsx` |
| `PZ-REOPEN-001` a `PZ-REOPEN-009` | `backend/tests/workOrderReopen.integration.test.js` |
| `PZ-REOPEN-010` a `PZ-REOPEN-011` | `frontend/tests/WorkOrderDetailPage.test.jsx`, `apiModules.test.js` |
| `PZ-ITEM-001` a `PZ-ITEM-010` | `backend/tests/workOrderItemLifecycle.integration.test.js`, `workOrders.integration.test.js` |
| `PZ-ITEM-011` | `frontend/tests/WorkOrderDetailPage.test.jsx` |
| `PZ-USER-*` | `backend/tests/userLifecycle.integration.test.js`, `frontend/tests/UsersPage.test.jsx` |
| `PZ-PERF-*` | `backend/tests/operationalQueries.integration.test.js`, `workOrders.integration.test.js` |
| `PZ-DASH-*` | `frontend/tests/DashboardPage.test.jsx`, `App.test.jsx`, `WorkOrdersPage.test.jsx` |
| `PZ-UX-*` | `frontend/tests/App.test.jsx`, `AuthContext.test.jsx`, `httpClientAuth.test.js`, `BikeMasters.test.jsx`, `ClientMasters.test.jsx`, `NewWorkOrderPage.test.jsx`, `UsersPage.test.jsx`, `WorkOrderDetailPage.test.jsx`, `responsiveStyles.test.js` |
| `PZ-MIG-*` | `backend/tests/schema.integration.test.js`, `productizationSchema.integration.test.js`, `clientContactMigration.integration.test.js`, `singleOpenOrderMigration.integration.test.js`, `operationalQueries.integration.test.js` |
| `P2-SEC-*`, `P0-INF-*` | `security.test.js`, configuración/guardas y `notFound.test.js` |
| `P1-FE-*`, `P1-UX-*`, `P2-FE-*` | suites homónimas bajo `frontend/tests/` indicadas en cada fila |

## Backend y persistencia

| ID | Requisito o riesgo | Archivo/caso de evidencia | Estado |
|---|---|---|---|
| P2-AUTH-001 | Seed ADMIN determinista, bcrypt e idempotente | `auth.integration.test.js`: seed idempotente sin plaintext | PASS |
| P2-AUTH-003A | Login ADMIN/MECANICO, claims mínimos y JSON seguro | `auth.integration.test.js`: login válido de ambos roles | PASS |
| P2-AUTH-003B | Email inexistente, password erróneo e inactivo producen el mismo 401 | matriz de credenciales genéricas | PASS |
| P2-AUTH-003C | bcrypt coste ≥10 y hash nunca serializado | caso de almacenamiento/serialización segura | PASS |
| P2-AUTH-004A | `/me` seguro; access ausente/malformado rechazado | casos de frontera del usuario/access | PASS |
| P2-AUTH-004B | JWT expirado, firma errónea, usuario ausente/inactivo falla | access rejection matrix | PASS |
| P2-AUTH-004C | Algoritmo y propósitos access/refresh no se cruzan | token purpose/algorithm case | PASS |
| P2-AUTH-005A | Refresh válido rota en la familia y revoca predecesor | transactional rotation case | PASS |
| P2-AUTH-005B | Refresh ausente, inválido o expirado no reemplaza | matriz de refresh inválido | PASS |
| P2-AUTH-007A | Replay revoca descendientes activos de la familia | rotated-token reuse case | PASS |
| P2-AUTH-007B | Replay no revoca otra familia de login | caso de familia independiente | PASS |
| P2-AUTH-006 | Logout revoca sólo sesión actual, limpia cookie y es idempotente | logout case | PASS |
| P2-AUTH-005C | Refresh concurrente no crea dos descendientes utilizables | concurrent refresh case | PASS |
| P2-SEC-001 | Abuso de login recibe 429 estable | rate-limit endpoint case | PASS |
| P2-RBAC-001 | Token ausente/malformado/inactivo devuelve 401 antes de validar | `rbac.integration.test.js`: auth boundary | PASS |
| P2-RBAC-002 | Rol autenticado sin permiso recibe 403 | `authorize.test.js` + RBAC HTTP | PASS |
| P2-RBAC-003A | Evolución aprobada: ADMIN crea maestras/órdenes; ambos roles leen el contexto permitido | RBAC resource matrix | PASS |
| P2-RBAC-003B | ADMIN agrega/elimina ítems; MECANICO agrega sólo sobre su orden asignada | item role + ownership matrices | PASS |
| P2-RBAC-003C | MECANICO avanza a tres estados intermedios | intermediate transitions case | PASS |
| P2-RBAC-004 | MECANICO no administra, elimina, entrega ni cancela | registration/users/items/status 403 | PASS |
| P2-RBAC-005 | Workflow inválido es 400; destino válido sin permiso es 403 | workflow vs role case | PASS |
| P2-USER-001 | ADMIN lista usuarios seguros; otros fallan | user list 200/401/403 | PASS |
| P2-AUTH-002 | ADMIN registra ambos roles y mass assignment se ignora | register roles case | PASS |
| P2-USER-005 | Email exacto/normalizado duplicado devuelve 409 | duplicate email cases | PASS |
| P2-USER-002 | Cambio de rol y errores inválido/ausente/prohibido | role update matrix | PASS |
| P2-USER-003 | Desactivar/reactivar; boolean/usuario inválido falla | active update matrix | PASS |
| P2-USER-006 | Desactivar invalida access inmediatamente | deactivation stale-token case | PASS |
| P2-USER-007 | Cambiar rol invalida access con rol obsoleto | stale-role token case | PASS |
| P2-USER-004 | Payload/modelo omite password/hash/token | aserciones profundas de payload seguro | PASS |
| P1-BE-001 | Crear cliente valida cédula y demás requeridos, email y normalización | `clientsBikes.integration.test.js`: POST matrix | PASS |
| P1-BE-002 | Buscar cliente por nombre/teléfono/email y vacío | Client GET search matrix | PASS |
| P1-BE-003 | Detalle cliente y 404/ID inválido | Client detail matrix | PASS |
| P1-BE-004 | Crear motocicleta, cilindrada opcional y cliente válido | Bike POST matrix | PASS |
| P1-DATA-003A | Placa exacta/mayúscula/espacios duplicada devuelve 409 | three HTTP duplicate cases | PASS |
| P1-DATA-003B | UNIQUE físico es barrera final de placa | `schema.integration.test.js`: normalized uniqueness | PASS |
| P1-BE-005 | Buscar placa exacta/prefijo normalizados y sin match | Bike search matrix | PASS |
| P1-BE-006 | Detalle Bike incluye owner/contexto y 403/404 | Bike detail matrix | PASS |
| P1-BE-007A | Orden válida inicia RECIBIDA/0.00 y bloquea mass assignment | `workOrders.integration.test.js`: create/defaults | PASS |
| P1-BE-007B | Bike inválida, faltantes y fechas ambiguas fallan | WorkOrder POST validation matrix | PASS |
| P1-BE-007C | `entryDate` omitida usa tiempo de servidor acotado | omitted-date case | PASS |
| PZ-OPEN-001 | La migración aborta con diagnóstico si ya existen dos órdenes abiertas | `singleOpenOrderMigration.integration.test.js`: preflight sin cambios | PASS |
| PZ-OPEN-002 | La columna generada y su UNIQUE impiden violar el invariante fuera del servicio | generated-column constraint case | PASS |
| PZ-OPEN-003 | Una segunda orden abierta devuelve `BIKE_HAS_ACTIVE_WORK_ORDER` sin efectos parciales | `workOrders.integration.test.js`: stable conflict case | PASS |
| PZ-OPEN-004 | Una falla nueva sí permite otra orden después de cerrar la anterior | closed-history/new-order case | PASS |
| PZ-OPEN-005 | Dos altas concurrentes producen exactamente un 201, un 409 y un solo ledger inicial | concurrent create case | PASS |
| PZ-OPEN-006 | Cierre concurrente contra nueva alta mantiene como máximo una orden abierta | `workOrderStatus.integration.test.js`: close/create race | PASS |
| P2-AUDIT-002A | Creación registra un `NULL → RECIBIDA` con actor/fecha/nota null | initial history case | PASS |
| P2-AUDIT-002B | Fallo del historial inicial revierte orden | create rollback case | PASS |
| P1-BE-008 | Lista/filtros status/placa/combinados funcionan | WorkOrder GET matrix | PASS |
| P1-BE-009A | Paginación/meta/defaults/máximo 100 | pagination validation cases | PASS |
| P1-BE-009B | Orden `entryDate DESC, id DESC` | deterministic ordering case | PASS |
| P1-BE-009C | Una auth + count/data, sin N+1 | query-hook assertion | PASS |
| P1-BE-010 | Detalle incluye WorkOrder/Bike/Client/items/total y 404 | detail graph cases | PASS |
| P1-BE-011A | Ambos tipos, cantidad fraccional y valor cero se aceptan | item creation cases | PASS |
| P1-BE-011B | Cantidad/valor/tipo/descripción inválidos fallan | item validation matrices | PASS |
| P1-BE-011C | Orden ausente no crea ítem; internos no controlan total | casos de recurso ausente/allowlist | PASS |
| P1-BE-013A | Total canónico 130000 y exactitud 0.10+0.20 | decimal total cases | PASS |
| P1-BE-013B | Fallo al persistir total revierte ítem | insertion rollback case | PASS |
| P1-BE-012 | Delete recalcula y último ítem queda 0.00 | delete cases | PASS |
| P1-BE-014 | Add/add y add/delete concurrentes preservan SUM/total | concurrency cases | PASS |
| P1-STATE-001 | Workflow forward completo persiste y conserva total | `workOrderStatus.integration.test.js`: full path | PASS |
| P1-STATE-002 | Cancelación desde cuatro estados no terminales | parameterized cancellation cases | PASS |
| P1-STATE-003 | Matriz 6×6 permite sólo avances/regresiones aprobados y rechaza el resto | transition matrix | PASS |
| P1-STATE-004 | Mismo estado da error estable; target desconocido valida | casos mismo/desconocido | PASS |
| P1-STATE-005 | Transiciones competidoras se serializan sin lost update | concurrency race cases | PASS |
| P2-AUDIT-003 | Cambio/cancelación válida guarda actor/from/to/fecha/nota una vez | caso de contenido del historial | PASS |
| P2-AUDIT-004 | Intentos inválidos/idempotentes/terminales/prohibidos no auditan | no-event matrix | PASS |
| P2-AUDIT-009 | Fallo de inserción audit revierte estado | transition rollback case | PASS |
| P2-AUDIT-005 | ADMIN lee todo historial; MECANICO sólo el propio, siempre seguro y newest-first | history + ownership cases | PASS |
| P2-AUDIT-007 | 150 filas empatadas paginan 100/50 con desempate ID | large-history case | PASS |
| P2-AUDIT-006 | Índice físico `(work_order_id, created_at DESC, id DESC)` | schema index metadata | PASS |
| P2-AUDIT-010 | Misma transición concurrente deja un cambio/evento | carrera al mismo target | PASS |
| PZ-AUDIT-001 | Snapshots/metadata usan allowlists deterministas por entidad/acción | snapshot and metadata cases | PASS |
| PZ-AUDIT-002 | Password, hash, tokens, cookies y secretos no entran al audit | USER allowlist + registro HTTP | PASS |
| PZ-AUDIT-003 | Altas, ítem, estado y cancelación generan una acción específica | mutation activation cases | PASS |
| PZ-AUDIT-004 | Actor autenticado prevalece sobre cualquier campo enviado | client actor-injection case | PASS |
| PZ-AUDIT-005 | Fallo del audit revierte maestras, usuario, orden/history, ítem/total y estado/history | forced audit failure cases | PASS |
| PZ-AUDIT-006 | Filtros, rango de fechas, paginación y detalle son acotados | ADMIN read/filter cases | PASS |
| PZ-AUDIT-007 | Sólo ADMIN lee; auth/RBAC preceden validación | audit authorization boundary | PASS |
| PZ-AUDIT-008 | No hay API de mutación y operaciones rechazadas no generan filas | no-mutation/no-event cases | PASS |
| PZ-CLIENT-001 | Migración canonicaliza contactos válidos y reaplica idempotente | contact migration valid case | PASS |
| PZ-CLIENT-002 | Preflight inválido aborta sin cambios ni filtrar valores | contact migration rejection case | PASS |
| PZ-CLIENT-003 | Phone/email se normalizan y formatos inválidos fallan | lifecycle contact validation case | PASS |
| PZ-CLIENT-004 | Nombre compartido se permite; contacto activo exige override justificado | duplicate-risk/override cases | PASS |
| PZ-CLIENT-005 | Contacto de eliminado obliga restore y no admite override de alta/update | restore-required cases | PASS |
| PZ-CLIENT-006 | Listado pagina/busca y filtra active/deleted/all con RBAC | lifecycle list cases | PASS |
| PZ-CLIENT-007 | Ambos leen activos; sólo ADMIN lee detalle eliminado | lifecycle detail boundary | PASS |
| PZ-CLIENT-008 | PATCH allowlist/no-op/clear email produce audit exacto | update lifecycle cases | PASS |
| PZ-CLIENT-009 | Soft delete preserva fila y bloquea cliente con motos activas | delete restriction cases | PASS |
| PZ-CLIENT-010 | Restore limpia lifecycle, no restaura motos y audita override | restore cases | PASS |
| PZ-CLIENT-011 | Sólo ADMIN muta clientes y auth/RBAC preceden validación | client mutation boundary | PASS |
| PZ-CLIENT-012 | Fallo audit revierte lifecycle y carrera con alta de moto es consistente | rollback/concurrency cases | PASS |
| PZ-CLIENT-013 | Alta exige cédula y normaliza puntos, espacios y guiones a 5–20 dígitos | `clientLifecycle.integration.test.js`: document validation case | PASS |
| PZ-CLIENT-014 | Cédula activa/eliminada no se duplica y el UNIQUE físico reserva su identidad | lifecycle conflicts + `schema.integration.test.js` | PASS |
| PZ-CLIENT-015 | Listado de clientes busca cédula por igualdad exacta | exact document list case | PASS |
| PZ-CLIENT-016 | Motos y órdenes aceptan filtro exacto de cédula y serializan el cliente identificado | `bikeLifecycle.integration.test.js` + `workOrders.integration.test.js` | PASS |
| PZ-CLIENT-017 | Formularios, selector reuse-first y maestras priorizan y muestran la cédula | `ClientMasters`, `BikeMasters`, `NewWorkOrderPage`, `WorkOrdersPage` | PASS |
| PZ-CLIENT-018 | Dos altas concurrentes con la misma cédula dejan un 201, un 409 y un solo audit | concurrent document creation case | PASS |
| PZ-BIKE-001 | Create normaliza placa y la reserva globalmente tras soft delete | create/deleted duplicate case | PASS |
| PZ-BIKE-002 | Listado pagina y filtra por igualdad, prefijo, owner y lifecycle | paginated filter matrix | PASS |
| PZ-BIKE-003 | Filtros de placa excluyentes y queries acotadas validan | invalid filter/bounds cases | PASS |
| PZ-BIKE-004 | Detalle muestra owner/orden abierta e historia usa `bikeId` paginado | detail/history context case | PASS |
| PZ-BIKE-005 | Ambos leen activas; sólo ADMIN lee eliminadas | lifecycle read boundary | PASS |
| PZ-BIKE-006 | PATCH general usa allowlist y audit before/after exacto | update audit case | PASS |
| PZ-BIKE-007 | No-op no audita y una eliminada es read-only | no-op/inactive update case | PASS |
| PZ-BIKE-008 | Update distingue placa ocupada activa de eliminada | plate conflict cases | PASS |
| PZ-BIKE-009 | Owner change dedicado conserva historia y audita anterior/nuevo | owner audit/history case | PASS |
| PZ-BIKE-010 | Owner inexistente/inactivo y moto eliminada se rechazan | invalid owner cases | PASS |
| PZ-BIKE-011 | Orden abierta bloquea soft delete; cerrada preserva historia | delete restriction case | PASS |
| PZ-BIKE-012 | Restore conserva identidad y exige propietario activo | restore lifecycle cases | PASS |
| PZ-BIKE-013 | Moto eliminada no admite nuevas órdenes | operational lifecycle case | PASS |
| PZ-BIKE-014 | Sólo ADMIN muta motos y RBAC precede validación | mutation boundary case | PASS |
| PZ-BIKE-015 | Fallo audit revierte update/owner/delete/restore | forced audit rollback case | PASS |
| PZ-BIKE-016 | Delete/orden y owner/delete cliente se serializan | concurrency invariant cases | PASS |
| PZ-ASSIGN-001 | Create acepta MECANICO activo opcional y lo incluye sólo en CREATED | assigned creation case | PASS |
| PZ-ASSIGN-002 | Usuario inexistente, ADMIN o inactivo no es asignable | invalid assignee matrix | PASS |
| PZ-ASSIGN-003 | ADMIN asigna, reasigna y devuelve una orden abierta a unassigned | assignment lifecycle cases | PASS |
| PZ-ASSIGN-004 | Reassign/unassign exigen razón; mismo destino no audita | reason/no-op cases | PASS |
| PZ-ASSIGN-005 | Orden cerrada rechaza cambios con conflicto estable | closed order case | PASS |
| PZ-ASSIGN-006 | Lista filtra por responsable y serializa identidad segura/null | filter/serialization case | PASS |
| PZ-ASSIGN-007 | Mecánico no asigna y fallo audit revierte el dominio | authorization/rollback cases | PASS |
| PZ-ASSIGN-008 | Dos reassign concurrentes confirman exactamente un evento | concurrent reassignment case | PASS |
| PZ-OWN-001 | MECANICO lista por defecto sólo sus órdenes y no amplía scope/filtro | mine/default/forbidden scope cases | PASS |
| PZ-OWN-002 | ADMIN lista all, unassigned y responsable exacto; contradicción valida | admin filter matrix | PASS |
| PZ-OWN-003 | Detalle permite orden propia y rechaza ajena/sin asignar | ownership detail cases | PASS |
| PZ-OWN-004 | Historial permite orden propia y rechaza ajena/sin asignar | ownership history cases | PASS |
| PZ-OWN-005 | Estado propio avanza; ajeno/sin asignar queda intacto | locked transition ownership cases | PASS |
| PZ-OWN-006 | Ítem propio se crea; ajeno/sin asignar no altera ítems/total/audit | locked item ownership cases | PASS |
| PZ-OWN-007 | Reasignación revoca al anterior y habilita inmediatamente al nuevo | post-reassignment access case | PASS |
| PZ-STATE-001 | El grafo admite exactamente las tres regresiones aprobadas | complete 6×6 matrix | PASS |
| PZ-STATE-002 | Las tres regresiones rechazan motivo ausente o vacío sin efectos | missing/blank reason cases | PASS |
| PZ-STATE-003 | ADMIN y MECANICO asignado ejecutan cada regresión | role/regression matrix | PASS |
| PZ-STATE-004 | History registra from/to, actor y motivo normalizado | regression history cases | PASS |
| PZ-STATE-005 | Audit registra STATUS_CHANGED, razón y transitionKind REGRESSION | regression audit cases | PASS |
| PZ-STATE-006 | Fallo audit revierte estado e history | forced regression audit failure | PASS |
| PZ-STATE-007 | Retrocesos arbitrarios, terminales y ENTREGADA por PATCH fallan | forbidden transition matrix | PASS |
| PZ-REOPEN-001 | Reapertura usa endpoint ADMIN dedicado y no abre el PATCH genérico | authorization/generic PATCH cases | PASS |
| PZ-REOPEN-002 | Sólo WARRANTY/SAME_ISSUE con reason válido pasan validación | validation matrix | PASS |
| PZ-REOPEN-003 | Sólo ENTREGADA puede volver a DIAGNOSTICO | persisted status matrix | PASS |
| PZ-REOPEN-004 | Bike y propietario eliminados bloquean sin efectos | deleted resource cases | PASS |
| PZ-REOPEN-005 | Otra orden abierta devuelve BIKE_HAS_ACTIVE_WORK_ORDER | competing open case | PASS |
| PZ-REOPEN-006 | Total/responsable se conservan; history/audit contienen actor, tipo y razón | both-type ledger cases | PASS |
| PZ-REOPEN-007 | Fallo audit revierte status e history | forced audit rollback case | PASS |
| PZ-REOPEN-008 | Dos reopens concurrentes dejan un único cambio/evento | concurrent reopen case | PASS |
| PZ-REOPEN-009 | Reopen contra create/delete conserva unicidad y lifecycle | cross-operation races | PASS |
| PZ-ITEM-001 | Alta atribuye actor autenticado e ignora suplantación del body | ADMIN/MECANICO attribution cases | PASS |
| PZ-ITEM-002 | Creador se serializa como ID/nombre seguro y legacy permanece null | creator detail cases | PASS |
| PZ-ITEM-003 | ENTREGADA/CANCELADA rechazan alta para ambos roles sin efectos | closed add matrix | PASS |
| PZ-ITEM-004 | ENTREGADA/CANCELADA rechazan delete y preservan ítem/total | closed delete matrix | PASS |
| PZ-ITEM-005 | Delete es ADMIN-only antes de validar ID | authorization boundary | PASS |
| PZ-ITEM-006 | Reopen habilita add propio y delete ADMIN con total exacto | reopened lifecycle case | PASS |
| PZ-ITEM-007 | ITEM_DELETED registra snapshot anterior, creador y actor | delete audit case | PASS |
| PZ-ITEM-008 | Fallo audit revierte delete y total | forced delete-audit failure | PASS |
| PZ-ITEM-009 | PATCH de ítem no existe y no reescribe evidencia | no-update route case | PASS |
| PZ-ITEM-010 | Add/delete contra close/reopen se serializa sin corrupción | item lifecycle races | PASS |
| PZ-USER-001 | Cambio de rol/actividad exige razón no vacía y acotada | `userLifecycle.integration.test.js`: reason validation | PASS |
| PZ-USER-002 | No se puede desactivar ni degradar al último ADMIN activo | last-admin conflict cases | PASS |
| PZ-USER-003 | Activar/desactivar/cambiar rol genera auditoría segura con razón y snapshots | active/role audit cases | PASS |
| PZ-USER-004 | Un mecánico con órdenes abiertas no puede desactivarse ni perder el rol | assigned-open-order conflict cases | PASS |
| PZ-USER-005 | Reasignar el trabajo desbloquea después la desactivación | reassignment-then-deactivation case | PASS |
| PZ-USER-006 | Dos reducciones ADMIN concurrentes dejan exactamente un administrador activo | concurrent ADMIN reduction case | PASS |
| PZ-USER-007 | Asignar contra desactivar nunca deja una orden en un mecánico inactivo | assignment/deactivation race | PASS |
| PZ-USER-008 | Autenticación/RBAC preceden la validación del lifecycle de usuarios | authorization-boundary case | PASS |
| PZ-PERF-001 | La placa de órdenes usa igualdad normalizada sin wildcard inicial | `workOrders.integration.test.js`: SQL shape/exact-match cases | PASS |
| PZ-PERF-002 | Los tres índices operativos nuevos y los guards previos existen exactamente | `operationalQueries.integration.test.js`: index inventory | PASS |
| PZ-PERF-003 | Los planes de placa, All, estado, moto y My Orders usan índices adecuados | EXPLAIN sobre 2.400 órdenes | PASS |
| PZ-PERF-004 | Count/data siguen acotados, deterministas y sin N+1/joins innecesarios | query-count and SQL-shape cases | PASS |
| P0-INF-003 | Ruta desconocida usa 404 centralizado seguro | `notFound.test.js` | PASS |
| P2-SEC-002A | Helmet, sin X-Powered-By, CSP API y HSTS por ambiente | `security.test.js`: header cases | PASS |
| P2-SEC-002B | CORS exacto/credentials/denegado/preflight/no-Origin | CORS cases + auth flow | PASS |
| P2-SEC-002C | JSON malformado 400 y >100 KiB 413 | parser boundary case | PASS |
| P2-SEC-004 | Excepción inesperada da 500 sin stack/SQL/path | caso 500 seguro | PASS |
| P2-SEC-003 | Configuración producción insegura falla al iniciar | application/auth config matrices | PASS |
| P0-INF-005 | Setup destructivo rechaza producción/desarrollo/no-test | `testDatabaseGuard.test.js` | PASS |
| P1-DATA-SCHEMA | El esquema original y el stack completo de quince migraciones aplican/revierten/reaplican con FKs/CHECK/ENUM/DECIMAL | `schema.integration.test.js`: schema lifecycle case | PASS |

## Frontend

| ID | Requisito o riesgo | Archivo/caso de evidencia | Estado |
|---|---|---|---|
| P2-FE-001A | Login exitoso redirige; fallo conserva error genérico | `App.test.jsx`: login cases | PASS |
| P2-FE-001B | Bootstrap restaura o queda anónimo sin flash protegido | `App.test.jsx`, `AuthContext.test.jsx` | PASS |
| P2-FE-001C | Guardas anónimo/login/ADMIN/MECANICO | casos completos de guardas de ruta | PASS |
| P2-FE-002A | Access desde memoria; nunca Web Storage | `httpClientAuth.test.js` storage assertions | PASS |
| P2-FE-002B | Cinco 401 usan un refresh y cinco retries | concurrent 401 case | PASS |
| P2-FE-002C | Fallo refresh limpia sesión y no reintenta negocio | caso de refresh fallido | PASS |
| P2-FE-002D | Cada request reintenta máximo una vez | one-retry case | PASS |
| P2-FE-002E | Refresh stale no revive logout; logout fallido limpia | refresh/logout race cases | PASS |
| P2-FE-003A | ADMIN lista/crea usuarios sin delete | `UsersPage.test.jsx` list/create case | PASS |
| P2-FE-003B | Rol exige guardar; deactivate confirma; activate funciona | user mutation cases | PASS |
| P2-FE-003C | Loading/error/retry/empty/create lock visibles | user state cases | PASS |
| P2-FE-004A | MECANICO agrega/avanza sólo su orden; no delete/deliver/cancel/users | mechanic controls/ownership cases | PASS |
| P2-FE-004B | ADMIN ve controles válidos y confirmaciones | admin detail cases | PASS |
| P2-FE-005 | Timeline muestra actor/from/to/note/inicial y estados/paginación | `HistoryTimeline.test.jsx` | PASS |
| P1-FE-001 | Lista muestra placa/cliente/estado/fecha/total y estados UI | `WorkOrdersPage.test.jsx` | PASS |
| P1-FE-002 | Filtros status/placa reinician página y consultan server | filter interaction case | PASS |
| P1-FE-003 | Paginación solicita página siguiente | pagination interaction | PASS |
| P1-FE-004 | Lookup Bike selecciona y crea sin status/total | `NewWorkOrderPage.test.jsx` | PASS |
| P1-FE-005 | Flujo faltante crea Client y Bike, luego selecciona | quick registration case | PASS |
| P1-UX-002 | Evita doble submit y muestra errores accionables | duplicate/error cases | PASS |
| P1-FE-006 | Detalle muestra relaciones/items/subtotales/total/loading/404 | detail cases | PASS |
| P1-FE-007 | Sólo transición válida con note; terminal sin acciones | detail + `apiModules.test.js` | PASS |
| P1-FE-008 | Add/delete confirma y refresca total autoritativo | item interaction case | PASS |
| P1-FE-009 | Multiplicación/formato evita float monetario | `formatters.test.js` | PASS |
| P1-UX-003 | Requeridos, tablas enfocables y acciones accesibles por rol | App/list/detail/users assertions | PASS |
| PZ-NEW-001 | MECANICO no accede a `/orders/new`; ADMIN conserva el flujo | route guard case | PASS |
| PZ-NEW-002 | Cliente existente se selecciona antes de consultar sus motos | existing-client flow | PASS |
| PZ-NEW-003 | Se listan y eligen motos activas pertenecientes al cliente | owned-bike selection case | PASS |
| PZ-NEW-004 | Alta subordinada maneja vacío, reutilización, override y restore | quick-registration duplicate cases | PASS |
| PZ-NEW-005 | Orden abierta conocida bloquea y enlaza a su detalle | active-order preflight case | PASS |
| PZ-NEW-006 | Conflicto tardío de orden abierta no duplica el request | race conflict/double-submit case | PASS |
| PZ-NEW-007 | Responsable activo opcional y unassigned producen payload correcto | mechanic/unassigned cases | PASS |
| PZ-NEW-008 | Fallo/retry de catálogo y mecánico desactualizado son recuperables | mechanics recovery cases | PASS |
| PZ-OWN-008 | MECANICO navega a Mis órdenes con scope mine y sin gestión de responsable | list/navigation/detail mechanic cases | PASS |
| PZ-OWN-009 | ADMIN alterna Todas/Sin asignar y ve responsable explícito | admin scope/list cases | PASS |
| PZ-OWN-010 | ADMIN asigna, reasigna y desasigna con razón/confirmación y estados UX | assignment panel cases | PASS |
| PZ-STATE-008 | Detalle ofrece los tres retornos con etiquetas y acciones por rol | regression control cases | PASS |
| PZ-STATE-009 | Regresión permanece bloqueada sin motivo y exige confirmación | reason/confirmation case | PASS |
| PZ-REOPEN-010 | Panel ADMIN ofrece tipos cerrados, reason y confirmación | admin reopen flow | PASS |
| PZ-REOPEN-011 | Panel se oculta por rol/estado, evita doble submit y presenta conflictos | role/error/loading cases | PASS |
| PZ-ITEM-011 | Detalle muestra creador, protege cerrado, rehabilita tras reopen y presenta conflicto tardío | item lifecycle UI cases | PASS |
| PZ-USER-009 | El conflicto por trabajo asignado enlaza a la cola exacta para reasignar | `UsersPage.test.jsx` + `WorkOrdersPage.test.jsx`: lifecycle recovery flow | PASS |
| PZ-DASH-001 | Dashboard ADMIN consulta las cuatro colas abiertas y enlaza filtros autoritativos | `DashboardPage.test.jsx`: ADMIN queues case | PASS |
| PZ-DASH-002 | Dashboard MECANICO usa exclusivamente `scope=mine` y oculta accesos ADMIN | mechanic dashboard case | PASS |
| PZ-DASH-003 | Dashboard presenta vacío, fallo y retry sin perder la operación | empty/retry cases | PASS |
| PZ-DASH-004 | Navegación, home y guardas exponen Dashboard/Audit según el rol | `App.test.jsx`: shell/route guard cases | PASS |
| PZ-AUDIT-009 | UI ADMIN lista auditoría segura con filtros acotados y paginación | `AuditPages.test.jsx`: list/filter cases | PASS |
| PZ-AUDIT-010 | Detalle muestra before/after/metadata inmutables y contexto legible | audit detail case | PASS |
| PZ-AUDIT-011 | Lista y detalle de auditoría tienen loading/error/retry/empty recuperables | audit recovery cases | PASS |
| PZ-UX-001 | Login retorna a la ruta solicitada completa y una sesión expirada conserva flujo seguro | `App.test.jsx` + `httpClientAuth.test.js`: return URL/failed refresh cases | PASS |
| PZ-UX-002 | Logout pendiente deshabilita la acción y bloquea doble envío | `App.test.jsx`: pending logout case | PASS |
| PZ-UX-003 | Navegación SPA mueve foco al contenido y búsqueda de propietario funciona con Enter | `App.test.jsx` + `BikeMasters.test.jsx`: keyboard cases | PASS |
| PZ-UX-004 | Edición de cliente/motocicleta reintenta su carga sin abandonar la ruta | `ClientMasters.test.jsx` + `BikeMasters.test.jsx`: edit retry cases | PASS |
| PZ-UX-005 | Conflicto de placa conduce a la maestra filtrada, incluso para registros eliminados | `NewWorkOrderPage.test.jsx` + `BikeMasters.test.jsx`: plate recovery flow | PASS |
| PZ-UX-006 | Orden, motocicleta y cliente relacionados son navegables por nombre/placa | `WorkOrderDetailPage.test.jsx`: related-resource links | PASS |
| PZ-UX-007 | Breakpoints conservan navegación, detalle, formularios, tablas y alertas accionables utilizables | `responsiveStyles.test.js`: tablet/mobile structural contract | PASS |

## Evidencia no funcional y documental

| ID | Requisito o riesgo | Evidencia | Estado |
|---|---|---|---|
| P1-DOC-001 | Install/lint/test/build ejecutables | clean-install HITO 14 + regresión/lint/build HITO 18 | PASS |
| P1-DOC-002 | Colección Postman cubre todas las rutas del producto con recorrido y variantes documentadas | parser JSON + inventario de 7 carpetas/36 requests y contratos HTTP | PASS |
| P2-AUDIT-008 | Historial <1s a escala de prueba | request 100/150: 9.40 ms, plan indexado | PASS |
| P0-DOC-001 | Arquitectura, negocio, seguridad y API documentados | documentos y ADR versionados | PASS |
| PZ-MIG-001 | Base vacía aplica y revierte las catorce migraciones sin residuos | `schema.integration.test.js`: full stack lifecycle | PASS |
| PZ-MIG-002 | Datos legacy sobreviven upgrade, down y reapply de 008–014 | `productizationSchema.integration.test.js`: populated baseline case | PASS |
| PZ-MIG-003 | Canonicalización de contactos es idempotente y aborta antes de alterar datos inválidos | `clientContactMigration.integration.test.js` | PASS |
| PZ-MIG-004 | Guard de orden abierta preflighta inconsistencias y aplica tras corrección humana | `singleOpenOrderMigration.integration.test.js` | PASS |
| PZ-MIG-005 | Índices de rendimiento tienen down/reapply reversible sin pérdida de dominio | `operationalQueries.integration.test.js`: migration lifecycle case | PASS |
| P0-DEMO-001 | Seed demo es determinista, exacto, idempotente, aislado y bloqueado en producción | `demoSeed.integration.test.js` | PASS |

## Ejecución consolidada — HITO 18

Fecha local: **2026-09-03**. Entorno: MySQL 8.4 en Docker, base exclusiva de integración configurada por el proyecto.

| Compuerta | Resultado observado |
|---|---|
| Backend completo | 28/28 suites, 342/342 pruebas PASS |
| Frontend completo | 15/15 suites, 104/104 pruebas PASS |
| Concurrencia crítica | 7 casos × 3 procesos frescos = 21/21 PASS |
| Lint | backend y frontend PASS |
| Build | frontend, 129 módulos transformados, PASS |
| Migraciones de desarrollo | 14 ejecutadas, 0 pendientes |

La repetición focalizada cubrió una carrera representativa de refresh, alta de orden, reasignación, transición, reapertura, mutación de ítem y reducción de administradores. Cada caso corrió una vez dentro de la suite completa y dos veces adicionales en procesos Vitest frescos.

## Ejecución de extensión de identificación — 2026-09-05

| Compuerta | Resultado observado |
|---|---|
| Backend completo | 28/28 suites, 348/348 pruebas PASS |
| Frontend completo | 15/15 suites, 105/105 pruebas PASS |
| Lint | backend y frontend PASS |
| Build | frontend, 130 módulos transformados, PASS |
| Matriz crítica | 241 IDs únicos, todos PASS |
| Migraciones de desarrollo | 15 ejecutadas, 0 pendientes |
| Demo | 20/20 clientes con cédula; 0 duplicadas |
| Smoke HTTP | cédula exacta: 1 cliente, 2 motos y 7 órdenes relacionadas |

## Regla de mantenimiento

Si cambia comportamiento, deben actualizarse implementación, test y matriz en el mismo hito. Una fila funcional conserva `PASS` sólo mientras exista la evidencia nombrada y la suite completa pase. El smoke manual es complementario, nunca reemplaza un caso automatizable.
