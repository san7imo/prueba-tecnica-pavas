# Matriz crítica de aceptación

## Propósito

Esta matriz es el gate de HITO 12 y HITO 14. Relaciona los comportamientos obligatorios de Fase 1/Fase 2 y los controles de riesgo aprobados con evidencia concreta. `PASS` significa que el caso nombrado fue recolectado y pasó en la suite completa; no representa un objetivo porcentual de coverage.

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
| P2-RBAC-003A | Ambos roles crean/leen recursos de negocio | RBAC resource matrix | PASS |
| P2-RBAC-003B | Ambos agregan ítems; sólo ADMIN elimina | item role matrix | PASS |
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
| P1-BE-001 | Crear cliente valida requeridos, email y normalización | `clientsBikes.integration.test.js`: POST matrix | PASS |
| P1-BE-002 | Buscar cliente por nombre/teléfono/email y vacío | Client GET search matrix | PASS |
| P1-BE-003 | Detalle cliente y 404/ID inválido | Client detail matrix | PASS |
| P1-BE-004 | Crear motocicleta, cilindrada opcional y cliente válido | Bike POST matrix | PASS |
| P1-DATA-003A | Placa exacta/mayúscula/espacios duplicada devuelve 409 | three HTTP duplicate cases | PASS |
| P1-DATA-003B | UNIQUE físico es barrera final de placa | `schema.integration.test.js`: normalized uniqueness | PASS |
| P1-BE-005 | Buscar placa parcial/minúscula/espacios/sin match | Bike search matrix | PASS |
| P1-BE-006 | Detalle Bike incluye Client y 404 | Bike detail matrix | PASS |
| P1-BE-007A | Orden válida inicia RECIBIDA/0.00 y bloquea mass assignment | `workOrders.integration.test.js`: create/defaults | PASS |
| P1-BE-007B | Bike inválida, faltantes y fechas ambiguas fallan | WorkOrder POST validation matrix | PASS |
| P1-BE-007C | `entryDate` omitida usa tiempo de servidor acotado | omitted-date case | PASS |
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
| P1-STATE-003 | Matriz 6×6 rechaza saltos, retroceso, igual y terminal | transition matrix | PASS |
| P1-STATE-004 | Mismo estado da error estable; target desconocido valida | casos mismo/desconocido | PASS |
| P1-STATE-005 | Transiciones competidoras se serializan sin lost update | concurrency race cases | PASS |
| P2-AUDIT-003 | Cambio/cancelación válida guarda actor/from/to/fecha/nota una vez | caso de contenido del historial | PASS |
| P2-AUDIT-004 | Intentos inválidos/idempotentes/terminales/prohibidos no auditan | no-event matrix | PASS |
| P2-AUDIT-009 | Fallo de inserción audit revierte estado | transition rollback case | PASS |
| P2-AUDIT-005 | Ambos roles leen historial seguro newest-first | caso de historial seguro | PASS |
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
| P0-INF-003 | Ruta desconocida usa 404 centralizado seguro | `notFound.test.js` | PASS |
| P2-SEC-002A | Helmet, sin X-Powered-By, CSP API y HSTS por ambiente | `security.test.js`: header cases | PASS |
| P2-SEC-002B | CORS exacto/credentials/denegado/preflight/no-Origin | CORS cases + auth flow | PASS |
| P2-SEC-002C | JSON malformado 400 y >100 KiB 413 | parser boundary case | PASS |
| P2-SEC-004 | Excepción inesperada da 500 sin stack/SQL/path | caso 500 seguro | PASS |
| P2-SEC-003 | Configuración producción insegura falla al iniciar | application/auth config matrices | PASS |
| P0-INF-005 | Setup destructivo rechaza producción/desarrollo/no-test | `testDatabaseGuard.test.js` | PASS |
| P1-DATA-SCHEMA | Siete migraciones apply/revert/reapply, FKs/CHECK/ENUM/DECIMAL | schema lifecycle case | PASS |

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
| P2-FE-004A | MECANICO agrega/avanza; no delete/deliver/cancel/users | mechanic controls cases | PASS |
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

## Evidencia no funcional y documental

| ID | Requisito o riesgo | Evidencia | Estado |
|---|---|---|---|
| P1-DOC-001 | Install/lint/test/build ejecutables | verificación desde entorno limpio en `testing.md`/reporte HITO 14 | PASS |
| P1-DOC-002 | Colección Postman válida y fiel | parser JSON + 5 carpetas/22 requests | PASS |
| P2-AUDIT-008 | Historial <1s a escala de prueba | request 100/150: 9.40 ms, plan indexado | PASS |
| P0-DOC-001 | Arquitectura, negocio, seguridad y API documentados | documentos y ADR versionados | PASS |

## Regla de mantenimiento

Si cambia comportamiento, deben actualizarse implementación, test y matriz en el mismo hito. Una fila funcional conserva `PASS` sólo mientras exista la evidencia nombrada y la suite completa pase. El smoke manual es complementario, nunca reemplaza un caso automatizable.
