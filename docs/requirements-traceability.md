# Trazabilidad de requisitos

## Leyenda

- `Foundation`: arquitectura, tooling o contrato establecido como fundamento; no representa una feature de negocio pendiente.
- `Pending`: implementación/evidencia aún no realizada.
- `Done`: comportamiento implementado con evidencia aprobada.

La tabla contiene 214 requisitos: 208 `Done` y 6 `Foundation`. No existen filas `Pending`. La matriz detallada requisito → riesgo → caso está en [test-acceptance-matrix.md](test-acceptance-matrix.md).

| ID | Requisito | Fase fuente | Implementación | Endpoint/UI | Prueba automatizada | Estado |
|---|---|---|---|---|---|---|
| P0-INF-001 | Backend Node/Express inicia | Fundación | `server.js`, `app.js` | `GET /api/health` | `health.test.js` | Foundation |
| P0-INF-002 | Frontend React inicia y compila | Fundación | Vite/React shell | `/orders` | `App.test.jsx` + build | Done |
| P0-INF-003 | Manejo técnico central de errores | Fundación | `AppError`, 404/error middleware | error envelope | `notFound.test.js` | Foundation |
| P0-INF-004 | MySQL local reproducible | Fundación | `docker-compose.yml` | N/A | health de Compose | Foundation |
| P0-INF-005 | Base exclusiva de tests | Fundación | `testDatabaseGuard`, `DB_NAME_TEST`, Umzug | N/A | guard + schema suite | Done |
| P0-DOC-001 | Monolito modular documentado | Fundación | `architecture.md`, ADR-001 | N/A | revisión documental | Foundation |
| P0-DOC-002 | ER completo documentado | Fundación | `database.md` | N/A | revisión documental | Foundation |
| P0-DOC-003 | Convenciones API/error documentadas | Fundación | `api.md` | `/api` | revisión documental | Foundation |
| P1-DATA-001 | Client y relación 1:N Bike | 1 | modelo/migración/asociación | persistencia | schema integration | Done |
| P1-DATA-002 | Bike con FK Client válida | 1 | Bike + `fk_bikes_client` | persistencia | FK/asociación | Done |
| P1-DATA-003 | Normalización y unicidad de placa en dos capas | 1 | validator/service/setter + UNIQUE | `POST /api/bikes` | duplicate HTTP + DB | Done |
| P1-DATA-004 | WorkOrder con FK Bike válida | 1 | modelo/migración | persistencia | FK/asociación | Done |
| P1-DATA-005 | WorkOrderItem y relación | 1 | modelo/migración | persistencia | FK/asociación | Done |
| P1-DATA-006 | Cantidad mayor que cero | 1 | validator/model/CHECK | Items API | HTTP + DB rejection | Done |
| P1-DATA-007 | Valor unitario mayor/igual cero | 1 | validator/model/CHECK | Items API | HTTP + DB rejection | Done |
| P1-DATA-008 | Dinero en `DECIMAL` | 1 | `DECIMAL(15,2)` | persistencia | exact reload | Done |
| P1-BE-001 | Crear cliente | 1 | módulo Client por capas | `POST /api/clients` | clientsBikes integration | Done |
| P1-BE-002 | Buscar clientes | 1 | consulta parcial parametrizada | `GET /api/clients?search=` | búsqueda/empty | Done |
| P1-BE-003 | Detalle cliente | 1 | service/repository | `GET /api/clients/:id` | 200/404/ID | Done |
| P1-BE-004 | Crear motocicleta | 1 | módulo Bike + relación/conflicto | `POST /api/bikes` | create/FK/duplicate | Done |
| P1-BE-005 | Buscar por placa | 1 evolucionado en HITO 4 | igualdad/prefijo normalizados e indexables | `GET /api/bikes?plate=&platePrefix=` | search matrix | Done |
| P1-BE-006 | Detalle motocicleta | 1 evolucionado en HITO 4 | owner + current open order | `GET /api/bikes/:id` | 200/403/404/context | Done |
| P1-BE-007 | Crear orden sólo con Bike válida, inicial RECIBIDA | 1 | WorkOrder service/defaults | `POST /api/work-orders` | create/default/FK | Done |
| P1-BE-008 | Listar/filtrar órdenes | 1 | eager query y filtros | `GET /api/work-orders` | status/plate/N+1 | Done |
| P1-BE-009 | Paginar órdenes con metadata | 1 | `findAndCountAll`, máximo 100 | orders list | page/meta/order | Done |
| P1-BE-010 | Detalle con Client/Bike/items | 1 | include graph/serializer | `GET /api/work-orders/:id` | detail graph | Done |
| P1-BE-011 | Agregar MANO_OBRA/REPUESTO | 1 | item validator/service/repository | POST items | type/validation/404 | Done |
| P1-BE-012 | Eliminar ítem | 1 | transacción y revalidación bloqueada | DELETE item | delete/zero/404 | Done |
| P1-BE-013 | Backend recalcula total add/delete | 1 | aggregate DECIMAL + ADR-004 | items/detail | 130000/0.30/rollback | Done |
| P1-BE-014 | Concurrencia de ítems conserva total | Contrato | transacción + WorkOrder lock | Items API | add/add, add/delete | Done |
| P1-STATE-001 | Flujo forward canónico | 1 | mapa + service transaccional | PATCH status | path + 6×6 | Done |
| P1-STATE-002 | Cancelar desde cuatro estados | 1 | aristas explícitas | PATCH status | cancellation matrix | Done |
| P1-STATE-003 | ENTREGADA/CANCELADA terminales | 1 | destinos vacíos | PATCH status | terminal matrix | Done |
| P1-STATE-004 | Transición inválida/idempotente devuelve 400 claro | 1/2 | `BusinessRuleError` | PATCH status | inválida/mismo estado | Done |
| P1-STATE-005 | Transiciones concurrentes serializadas | Contrato | transaction + `FOR UPDATE` | PATCH status | races | Done |
| P1-FE-001 | Tabla placa/cliente/estado/fecha/total | 1 | page/table/formatters | `/orders` | render | Done |
| P1-FE-002 | Filtros estado/placa | 1 | controlled filters/API | `/orders` | filter request | Done |
| P1-FE-003 | Paginación de órdenes | 1 | `Pagination` con metadata | `/orders` | next/boundary | Done |
| P1-FE-004 | Crear seleccionando Bike por placa | 1 | `BikeLookup` + payload explícito | `/orders/new` | flujo con Bike existente | Done |
| P1-FE-005 | Registro rápido Client/Bike | 1 | `QuickRegistration` secuencial | `/orders/new` | client→bike | Done |
| P1-FE-006 | Detalle con relaciones/items/total | 1 | detail page/components | `/orders/:id` | detail render | Done |
| P1-FE-007 | Sólo acciones de estado válidas | 1 | mapa visual de transiciones | `/orders/:id` | permitida/terminal | Done |
| P1-FE-008 | Gestión de ítems | 1 | form/table/confirm/refetch | `/orders/:id` | add/delete | Done |
| P1-UX-001 | Errores y loaders claros | 1 | panels/feedback localizados | vistas requeridas | state cases | Done |
| P1-UX-002 | Empty/disabled/doble-submit | Contrato | estados UI y locks | vistas requeridas | state cases | Done |
| P1-UX-003 | Responsive/accesibilidad | Contrato | focus/labels/mobile cards | vistas requeridas | role assertions + smoke | Done |
| P1-DOC-001 | Source, migraciones y setup README | 1 | repo + guía española | entrega | clean migration/boot/build | Done |
| P1-DOC-002 | Colección Postman | Contrato | colección completa | API | estructura + smoke | Done |
| P2-DATA-001 | User único con role/active | 2 | modelo/migración User | Auth | schema/auth tests | Done |
| P2-DATA-002 | Refresh sólo como digest | Opción proyecto | modelo/migración + SHA-256 | refresh/logout | persistence inspection | Done |
| P2-AUTH-001 | Seed ADMIN inicial | 2 | `seedInitialAdmin` env/idempotente | login | seed/hash/idempotency | Done |
| P2-AUTH-002 | Registro sólo ADMIN | 2 | auth/RBAC/validation | `POST /api/auth/register` | roles/401/403/duplicate | Done |
| P2-AUTH-003 | Login genérico, bcrypt y JWT | 2 | AuthService | `POST /api/auth/login` | login matrix | Done |
| P2-AUTH-004 | Perfil autenticado seguro | 2 | authenticate + DB lookup | `GET /api/auth/me` | token/profile matrix | Done |
| P2-AUTH-005 | Rotación refresh en HttpOnly cookie | Opción proyecto | AuthService transaccional | refresh | cookie/rotation/race | Done |
| P2-AUTH-006 | Logout revoca y limpia | Opción proyecto | revocación de token actual | logout | idempotent/session-scope | Done |
| P2-AUTH-007 | Replay revoca familia activa | Contrato | family tracking/revocation | refresh | replay/families/race | Done |
| P2-RBAC-001 | Toda ruta negocio autentica | 2 | router authenticate | business API | token matrix | Done |
| P2-RBAC-002 | Rol incorrecto devuelve 403 | 2 | `authorize` + error | restricted API | unit/HTTP | Done |
| P2-RBAC-003 | MECANICO agrega ítems/avanza tres estados | 2 | routes + política de estado | items/status | ruta permitida | Done |
| P2-RBAC-004 | MECANICO no entrega/cancela/elimina | 2 | role guards/service | items/status | 403 + persistence | Done |
| P2-USER-001 | ADMIN lista usuarios | 2 | UserService/repository seguro | `GET /api/users` | 200/401/403 | Done |
| P2-USER-002 | ADMIN cambia rol | 2 | validated update | PATCH role | update/errors/effect | Done |
| P2-USER-003 | ADMIN activa/desactiva | 2 | strict boolean update | PATCH active | update/errors/effect | Done |
| P2-USER-004 | Password/hash nunca retorna | 2 | modelo/serializadores seguros | Auth/User APIs | aserciones profundas | Done |
| P2-AUDIT-001 | Esquema history con actor/from/to/note/time | 2 | migración/modelo/FKs | history | metadata/contenido | Done |
| P2-AUDIT-002 | Evento inicial con creador | Interpretación 2 | creación + insert atómico | create/history | event/rollback | Done |
| P2-AUDIT-003 | Cada cambio válido/cancel crea una fila | 2 | locked update + insert | status/history | exact row | Done |
| P2-AUDIT-004 | Rechazados/idempotentes sin historial | 2 | validación antes de writes | status/history | absence cases | Done |
| P2-AUDIT-005 | Historial inmutable y newest-first | 2 | consulta append-only/ordenada | history | seguridad/orden/empates | Done |
| P2-AUDIT-006 | Índice conserva prefijo requerido | 2 | composite descending index | N/A | MySQL metadata | Done |
| P2-AUDIT-007 | Paginación history, máximo 100, ties | 2 | bounded query | GET history | 150 rows | Done |
| P2-AUDIT-008 | Historial menor a 1s | 2 | indexed bounded query | history UI/API | 9.40 ms observation | Done |
| P2-FE-001 | Login y guardas de ruta/rol | 2 | pages/guards | `/login` + privadas | route matrix | Done |
| P2-FE-002 | Restaurar, renovar y cerrar sesión | 2 | AuthContext/interceptors | shell | bootstrap + five 401 | Done |
| P2-FE-003 | UI ADMIN de usuarios | 2 | UsersPage/users API | `/admin/users` | list/create/role/active | Done |
| P2-FE-004 | Acciones por rol | 2 | role-filtered controls | detail | ADMIN/MECANICO | Done |
| P2-FE-005 | Timeline fecha/actor/from/to/note | 2 | HistoryTimeline paginado | detalle | render/estados/página | Done |
| P2-SEC-001 | Rate limiting de login | 2 | login limiter | login | stable 429 | Done |
| P2-SEC-002 | Helmet, CORS restringido, body limit | Contrato | app/CORS/parser | API | security suite | Done |
| P2-SEC-003 | Cookie y secretos seguros | 2/Contrato | cookie/startup validation | Auth | config/cookie tests | Done |
| P2-SEC-004 | Sin fuga de stack/SQL/JWT/secreto | Contrato | sanitizador/serializadores | errores/logs | payload seguro/500 | Done |
| PZ-CLIENT-001 | Contactos existentes se canonicalizan con preflight atómico | HITO 3 | migración `012` data-only | persistencia | contact migration valid/invalid | Done |
| PZ-CLIENT-002 | Phone/email usan formato canónico validado | HITO 3 | validator, setter y normalizador compartido | Client API | contact validation | Done |
| PZ-CLIENT-003 | Riesgo duplicado usa contacto exacto, nunca nombre | HITO 3 | ClientService + búsqueda exacta activa/eliminada | POST/PATCH/restore Client | duplicate-risk matrix | Done |
| PZ-CLIENT-004 | Override de duplicado activo exige confirmación y razón | HITO 3 | validación + evento con metadatos permitidos | POST/PATCH/restore Client | override/audit cases | Done |
| PZ-CLIENT-005 | Contacto de eliminado obliga restaurar | HITO 3 | conflicto `CLIENT_RESTORE_REQUIRED` | POST/PATCH Client | restore-required cases | Done |
| PZ-CLIENT-006 | Listado de clientes pagina, busca y filtra lifecycle | HITO 3 | repository/service paginado, máximo 100 | `GET /api/clients` | list/search/lifecycle cases | Done |
| PZ-CLIENT-007 | Activos son legibles por ambos roles; eliminados sólo ADMIN | HITO 3 | autorización contextual backend | GET Client APIs | lifecycle RBAC cases | Done |
| PZ-CLIENT-008 | Cliente activo admite PATCH allowlisted y auditable | HITO 3 | transacción, lock y snapshots desacoplados | `PATCH /api/clients/:id` | update/no-op/rollback | Done |
| PZ-CLIENT-009 | Soft delete preserva historia y bloquea motos activas | HITO 3 | lock Client→Bike, sin cascade | `DELETE /api/clients/:id` | delete/restriction/race | Done |
| PZ-CLIENT-010 | Restore limpia lifecycle sin restaurar motocicletas | HITO 3 | transacción y auditoría `RESTORED` | `POST /api/clients/:id/restore` | restore/override/rollback | Done |
| PZ-CLIENT-011 | Sólo ADMIN puede mutar maestras de clientes | HITO 3 | RBAC previo a validación | Client mutation APIs | auth boundary cases | Done |
| PZ-CLIENT-012 | Alta de moto y borrado de cliente serializan el propietario | HITO 3 | lock canónico sobre Client | POST Bike / DELETE Client | concurrency invariant | Done |
| PZ-BIKE-001 | Placa permanece única entre motos activas/eliminadas | HITO 4 | UNIQUE global + conflicto contextual | POST/PATCH Bike | plate lifecycle cases | Done |
| PZ-BIKE-002 | Lista paginada filtra exacto/prefijo/owner/lifecycle | HITO 4 | índices existentes + repository acotado | `GET /api/bikes` | filter/pagination matrix | Done |
| PZ-BIKE-003 | Filtros de placa son excluyentes y sin wildcard inicial | HITO 4 | validator + igualdad/prefijo | `GET /api/bikes` | invalid/exact/prefix cases | Done |
| PZ-BIKE-004 | Detalle incluye propietario y orden abierta | HITO 4 | consulta summary sin ítems | `GET /api/bikes/:id` | detail context case | Done |
| PZ-BIKE-005 | Historia de la motocicleta se pagina por identidad | HITO 4 | filtro exacto `bikeId` | `GET /api/work-orders` | history pagination case | Done |
| PZ-BIKE-006 | Activas son legibles por ambos; eliminadas sólo ADMIN | HITO 4 | autorización contextual backend | GET Bike APIs | lifecycle RBAC cases | Done |
| PZ-BIKE-007 | PATCH general es allowlisted, bloqueado y auditable | HITO 4 | transacción + snapshot desacoplado | `PATCH /api/bikes/:id` | update/no-op/rollback | Done |
| PZ-BIKE-008 | Owner change separado exige destino activo y razón | HITO 4 | locks Client(s)→Bike | `PATCH /api/bikes/:id/owner` | owner validation/audit | Done |
| PZ-BIKE-009 | Owner change conserva órdenes bajo el mismo bikeId | HITO 4 | actualización sólo de `client_id` | owner API | historical identity case | Done |
| PZ-BIKE-010 | Soft delete preserva historia y bloquea orden abierta | HITO 4 | lock Client→Bike→WorkOrder, sin cascade | `DELETE /api/bikes/:id` | delete restriction case | Done |
| PZ-BIKE-011 | Restore conserva placa/owner y exige owner activo | HITO 4 | lifecycle transaction | `POST /api/bikes/:id/restore` | restore cases | Done |
| PZ-BIKE-012 | Moto eliminada no recibe nuevas órdenes | HITO 4 | revalidación Client→Bike | `POST /api/work-orders` | inactive bike case | Done |
| PZ-BIKE-013 | Sólo ADMIN muta motocicletas | HITO 4 | RBAC antes de validación | Bike mutation APIs | auth boundary case | Done |
| PZ-BIKE-014 | Auditoría falla de forma atómica en todo el lifecycle | HITO 4 | domain + audit transaction | Bike mutation APIs | forced rollback cases | Done |
| PZ-BIKE-015 | Delete moto y create orden se serializan | HITO 4 | locks compartidos Client→Bike | DELETE Bike / POST Order | concurrency race | Done |
| PZ-BIKE-016 | Owner change y delete cliente destino se serializan | HITO 4 | clientes por ID→Bike | owner/delete APIs | concurrency race | Done |
| PZ-ASSIGN-001 | Orden puede crearse con un responsable válido opcional | HITO 7 | lock Client→Bike→User y snapshot CREATED | `POST /api/work-orders` | assigned create/invalid targets | Done |
| PZ-ASSIGN-002 | Sólo un MECANICO activo es asignable | HITO 7 | validación persistida bajo lock | create/assignment APIs | missing/role/inactive matrix | Done |
| PZ-ASSIGN-003 | ADMIN asigna, reasigna o devuelve a unassigned | HITO 7 | PATCH dedicado y FK escalar | `PATCH /api/work-orders/:id/assignment` | assignment lifecycle | Done |
| PZ-ASSIGN-004 | Reassign/unassign exigen razón y no-op se rechaza | HITO 7 | reglas de servicio + validator acotado | assignment API | reason/no-op cases | Done |
| PZ-ASSIGN-005 | Órdenes cerradas no cambian responsable | HITO 7 | status revalidado bajo lock | assignment API | closed conflict case | Done |
| PZ-ASSIGN-006 | Lista/detalle exponen responsable seguro y filtran por ID | HITO 7 | include allowlisted + filtro indexado | Work Order GET APIs | filter/serialization cases | Done |
| PZ-ASSIGN-007 | Cada cambio queda auditado atómicamente | HITO 7 | ASSIGNED/REASSIGNED/UNASSIGNED en transacción | assignment API | snapshots/rollback cases | Done |
| PZ-ASSIGN-008 | Reasignaciones concurrentes no pierden actualizaciones | HITO 7 | User IDs asc→WorkOrder + revalidación | assignment API | concurrent reassignment | Done |
| PZ-NEW-001 | Sólo ADMIN accede al alta de orden | HITO 8 | `RoleRoute` + RBAC backend existente | `/orders/new`, POST Work Order | route guard + backend authorization | Done |
| PZ-NEW-002 | El flujo selecciona primero un cliente activo existente | HITO 8 | `ClientSelector` + orquestación local | `/orders/new` | existing-client flow | Done |
| PZ-NEW-003 | Sólo se ofrecen motocicletas activas del cliente elegido | HITO 8 | listado por `clientId/lifecycle` + detail recheck | `/orders/new` | owned-bike selection | Done |
| PZ-NEW-004 | Altas de maestras son ramas subordinadas con política de duplicados | HITO 8 | `QuickRegistration` + `DuplicateConflict` | `/orders/new` | empty/reuse/override/restore cases | Done |
| PZ-NEW-005 | Cliente o moto eliminados no entran al flujo operacional | HITO 8 | filtrado defensivo + backend autoritativo | `/orders/new` | lifecycle conflict cases | Done |
| PZ-NEW-006 | Orden abierta bloquea antes del alta y un conflicto tardío se presenta claramente | HITO 8 | detail precheck + manejo `BIKE_HAS_ACTIVE_WORK_ORDER` | `/orders/new` | preflight/race conflict cases | Done |
| PZ-NEW-007 | Responsable inicial es MECANICO activo opcional o unassigned explícito | HITO 8 | catálogo filtrado + validación backend HITO 7 | `/orders/new` | assigned/unassigned/stale cases | Done |
| PZ-NEW-008 | Cargas, retry, validación y doble submit están controlados por paso | HITO 8 | estados locales y locks con refs | `/orders/new` | loading/error/retry/double-submit cases | Done |
| PZ-OWN-001 | MECANICO lista por defecto y exclusivamente sus órdenes | HITO 9 | scope contextual forzado desde auth | `GET /api/work-orders` | mine/default/forbidden scope cases | Done |
| PZ-OWN-002 | ADMIN conserva vistas all/unassigned y filtro por responsable | HITO 9 | scopes allowlisted + filtro escalar | `GET /api/work-orders` | admin filter matrix | Done |
| PZ-OWN-003 | MECANICO sólo consulta detalle de una orden propia | HITO 9 | autorización contextual de servicio | `GET /api/work-orders/:id` | own/foreign/unassigned detail cases | Done |
| PZ-OWN-004 | MECANICO sólo consulta historial de una orden propia | HITO 9 | resolución de identidad antes del history | `GET /api/work-orders/:id/history` | own/foreign/unassigned history cases | Done |
| PZ-OWN-005 | MECANICO sólo cambia estado en su orden asignada | HITO 9 | ownership persistido bajo WorkOrder lock | status API | own/foreign/unassigned transition cases | Done |
| PZ-OWN-006 | MECANICO sólo agrega ítems en su orden asignada | HITO 9 | ownership persistido bajo WorkOrder lock | item create API | own/foreign/unassigned item cases | Done |
| PZ-OWN-007 | Reasignar revoca acceso anterior y habilita al nuevo responsable | HITO 9 | autorización siempre contra asignación actual | Work Order read/mutation APIs | post-reassignment access case | Done |
| PZ-OWN-008 | Frontend MECANICO ofrece Mis órdenes sin controles de asignación | HITO 9 | navegación/consulta role-aware | `/orders`, `/orders/:id` | mechanic UI cases | Done |
| PZ-OWN-009 | Frontend ADMIN ofrece colas Todas/Sin asignar y responsable visible | HITO 9 | scope switch + columna responsable | `/orders` | admin scope UI cases | Done |
| PZ-OWN-010 | ADMIN gestiona asignación con razón, confirmación y recuperación | HITO 9 | `AssignmentPanel` + API dedicada | `/orders/:id` | assign/reassign/unassign/error/closed cases | Done |
| PZ-STATE-001 | Sólo las tres regresiones genéricas aprobadas amplían el grafo | HITO 10 | matriz explícita por estado | status API | complete 6×6 matrix | Done |
| PZ-STATE-002 | Toda regresión exige motivo no vacío | HITO 10 | clasificación y validación bajo WorkOrder lock | status API | missing/blank reason cases | Done |
| PZ-STATE-003 | ADMIN y MECANICO asignado ejecutan las tres regresiones | HITO 10 | RBAC + ownership contextual | status API | role/regression matrix | Done |
| PZ-STATE-004 | History conserva from/to, actor y motivo de regresión | HITO 10 | ledger inmutable en la transacción | status/history APIs | regression history cases | Done |
| PZ-STATE-005 | Audit distingue regresión con razón y metadata allowlisted | HITO 10 | `STATUS_CHANGED` + `transitionKind=REGRESSION` | audit read API | regression audit cases | Done |
| PZ-STATE-006 | Fallo audit revierte estado e history de la regresión | HITO 10 | transacción única | status API | forced audit rollback case | Done |
| PZ-STATE-007 | Retrocesos arbitrarios, terminales y reopen genérico siguen prohibidos | HITO 10 | grafo cerrado; sin arista ENTREGADA | status API | forbidden transition matrix | Done |
| PZ-STATE-008 | UI muestra los tres retornos con etiquetas inequívocas según rol | HITO 10 | matriz frontend alineada | `/orders/:id` | regression control cases | Done |
| PZ-STATE-009 | UI bloquea sin motivo y confirma antes de enviar una regresión | HITO 10 | validación/confirmación defensiva | `/orders/:id` | reason/confirmation case | Done |
| PZ-REOPEN-001 | Reapertura es endpoint dedicado sólo ADMIN; PATCH genérico sigue cerrado | HITO 11 | route RBAC + service separado | `POST /work-orders/:id/reopen` | auth/generic PATCH cases | Done |
| PZ-REOPEN-002 | Sólo WARRANTY/SAME_ISSUE y reason no vacío son válidos | HITO 11 | validator allowlisted | reopen API | validation matrix | Done |
| PZ-REOPEN-003 | Sólo una orden actualmente ENTREGADA puede reabrirse | HITO 11 | estado revalidado bajo lock | reopen API | status matrix | Done |
| PZ-REOPEN-004 | Bike y propietario deben estar activos | HITO 11 | locks Client → Bike + lifecycle recheck | reopen API | deleted resource cases | Done |
| PZ-REOPEN-005 | Otra orden abierta bloquea la reapertura | HITO 11 | open-order query bloqueada + UNIQUE físico | reopen API | competing open case | Done |
| PZ-REOPEN-006 | Reopen conserva total/responsable y registra history/audit exactos | HITO 11 | transacción + ledgers append-only | reopen/history/audit APIs | both-type ledger cases | Done |
| PZ-REOPEN-007 | Fallo audit revierte status e history | HITO 11 | transacción única | reopen API | forced audit failure | Done |
| PZ-REOPEN-008 | Dos reopens concurrentes confirman máximo uno | HITO 11 | locks canónicos + estado persistido | reopen API | concurrent reopen case | Done |
| PZ-REOPEN-009 | Reopen se serializa contra alta y delete sin violar invariantes | HITO 11 | locks compartidos Client → Bike → WorkOrder | reopen/create/delete APIs | cross-operation races | Done |
| PZ-REOPEN-010 | UI ADMIN ofrece sólo tipos válidos, reason y confirmación | HITO 11 | `ReopenPanel` + API dedicada | `/orders/:id` | admin reopen flow | Done |
| PZ-REOPEN-011 | UI oculta por rol/estado, evita doble submit y muestra conflictos | HITO 11 | render condicional + estado local | `/orders/:id` | role/error/loading cases | Done |
| PZ-ITEM-001 | Alta atribuye ADMIN/MECANICO autenticado e ignora actor del body | HITO 12 | allowlist + `req.user` dentro de transacción | POST items | actor attribution cases | Done |
| PZ-ITEM-002 | API expone creador seguro y mantiene null para legacy | HITO 12 | include/serializer ID+name | order detail/item response | creator serialization cases | Done |
| PZ-ITEM-003 | ENTREGADA/CANCELADA rechazan alta sin efectos | HITO 12 | status revalidado bajo WorkOrder lock | POST items | closed add matrix | Done |
| PZ-ITEM-004 | ENTREGADA/CANCELADA rechazan delete y preservan total/fila | HITO 12 | WorkOrder lock antes de item | DELETE item | closed delete matrix | Done |
| PZ-ITEM-005 | Delete continúa sólo ADMIN antes de validar ID | HITO 12 | route RBAC | DELETE item | authorization boundary | Done |
| PZ-ITEM-006 | Reopen habilita nuevamente add/delete según rol | HITO 12 | estado DIAGNOSTICO confirmado | reopen/items APIs | reopened lifecycle case | Done |
| PZ-ITEM-007 | Delete audita snapshot anterior, creador y actor | HITO 12 | `ITEM_DELETED` allowlisted | audit API | delete audit case | Done |
| PZ-ITEM-008 | Fallo audit revierte delete y total | HITO 12 | transacción única | DELETE item | forced audit rollback | Done |
| PZ-ITEM-009 | No existe endpoint de update de ítem | HITO 12 | routing cerrado | PATCH item | no-update case | Done |
| PZ-ITEM-010 | Mutaciones contra close/reopen preservan estado y total exacto | HITO 12 | lock compartido WorkOrder + revalidación | items/status/reopen APIs | concurrency race cases | Done |
| PZ-ITEM-011 | UI muestra creador y protege controles cerrado/reabierto | HITO 12 | tabla/form role-state-aware | `/orders/:id` | creator/closed/reopen/error cases | Done |
| PZ-OPEN-001 | Upgrade aborta sin alterar datos si ya existen dos órdenes abiertas | HITO 6 | preflight de migración `013` | persistencia | invalid upgrade case | Done |
| PZ-OPEN-002 | La base impone máximo una orden abierta por moto | HITO 6 | generated `open_bike_id` + UNIQUE | persistencia | direct DB constraint | Done |
| PZ-OPEN-003 | Segunda orden abierta devuelve conflicto estable sin parciales | HITO 6 | servicio transaccional + mapping UNIQUE | POST Work Order | conflict/rollback case | Done |
| PZ-OPEN-004 | Una falla distinta admite nueva orden después del cierre | HITO 6 | estados abiertos/cerrados explícitos | POST Work Order | closed-history/new case | Done |
| PZ-OPEN-005 | Dos altas concurrentes confirman como máximo una | HITO 6 | Client→Bike lock + UNIQUE | POST Work Order | concurrent create | Done |
| PZ-OPEN-006 | Cierre concurrente con alta conserva el invariante | HITO 6 | WorkOrder lock + revalidación | status/create APIs | close/create race | Done |
| PZ-AUDIT-001 | Snapshots y metadata usan allowlists deterministas | HITO 2 | `auditService` + builders por acción | audit ledger | snapshot matrix | Done |
| PZ-AUDIT-002 | Secretos, credenciales y tokens nunca entran al audit | HITO 2 | allowlist USER y serialización explícita | mutation/audit APIs | sensitive-field cases | Done |
| PZ-AUDIT-003 | Mutaciones importantes generan acciones específicas | HITO 2 | evento dentro de transacción de dominio | mutation APIs | activation cases | Done |
| PZ-AUDIT-004 | Actor proviene sólo de identidad autenticada | HITO 2 | `req.user` → service | mutation APIs | actor injection case | Done |
| PZ-AUDIT-005 | Fallo del audit revierte la mutación completa | HITO 2 | transacción compartida | mutation APIs | forced failure matrix | Done |
| PZ-AUDIT-006 | Lectura filtra/pagina y detalle es seguro | HITO 2 | repository acotado + serializer | GET Audit APIs | filter/detail cases | Done |
| PZ-AUDIT-007 | Sólo ADMIN consulta auditoría | HITO 2 | auth/RBAC antes de validation | GET Audit APIs | authorization boundary | Done |
| PZ-AUDIT-008 | Ledger no tiene API de mutación | HITO 2 | routes/repository append-only | Audit API | no-mutation cases | Done |
| PZ-AUDIT-009 | UI ADMIN lista y filtra eventos | HITO 14 | `AuditListPage` | `/admin/audit` | list/filter/pagination | Done |
| PZ-AUDIT-010 | UI presenta actor, razón y snapshots legibles | HITO 14 | `AuditDetailPage` | `/admin/audit/:id` | detail case | Done |
| PZ-AUDIT-011 | Vistas audit tienen loading/error/retry/empty | HITO 14 | estados recuperables | Audit pages | recovery cases | Done |
| PZ-USER-001 | Cambiar rol/actividad exige razón acotada | HITO 13 | validator + service | PATCH User APIs | reason validation | Done |
| PZ-USER-002 | Último ADMIN activo no puede desactivarse/degradarse | HITO 13 | lock y conteo revalidado | PATCH User APIs | last-admin cases | Done |
| PZ-USER-003 | Cambios de usuario se auditan con razón y snapshots | HITO 13 | transacción USER/audit | PATCH User APIs | audit cases | Done |
| PZ-USER-004 | Mecánico con órdenes abiertas conserva rol/actividad | HITO 13 | consulta bloqueada de asignaciones | PATCH User APIs | assigned conflict | Done |
| PZ-USER-005 | Reasignar trabajo desbloquea el lifecycle del mecánico | HITO 13 | invariant shared con assignment | Users/Orders APIs | recovery flow | Done |
| PZ-USER-006 | Reducciones ADMIN concurrentes dejan uno activo | HITO 13 | locks por ID + revalidación | PATCH User APIs | concurrent reduction | Done |
| PZ-USER-007 | Asignar contra desactivar no deja trabajo huérfano | HITO 13 | orden canónico User→WorkOrder | Users/Orders APIs | lifecycle race | Done |
| PZ-USER-008 | Auth/RBAC preceden validación de usuario | HITO 13 | middleware order | PATCH User APIs | boundary case | Done |
| PZ-USER-009 | UI enlaza conflicto a la cola de reasignación | HITO 13 | feedback accionable | Users/Orders pages | recovery UI case | Done |
| PZ-DASH-001 | Dashboard ADMIN consulta cuatro colas abiertas reales | HITO 14 | queries por status/scope | `/dashboard` | admin queues | Done |
| PZ-DASH-002 | Dashboard MECANICO consulta sólo `mine` | HITO 14 | scope role-aware + backend | `/dashboard` | mechanic dashboard | Done |
| PZ-DASH-003 | Dashboard maneja vacío, fallo y retry | HITO 14 | estados por cola | `/dashboard` | recovery cases | Done |
| PZ-DASH-004 | Navegación y guardas exponen rutas por rol | HITO 14 | AppLayout/RoleRoute | shell/rutas | route matrix | Done |
| PZ-PERF-001 | Placa de órdenes usa igualdad normalizada indexable | HITO 15 | join Bike por igualdad, sin wildcard inicial | `GET /api/work-orders?plate=` | exact/incomplete/SQL shape | Done |
| PZ-PERF-002 | All, estado, moto y responsable tienen índices alineados con filtro/orden | HITO 15 | migración reversible `014` | listados y dashboard | metadata + EXPLAIN con 2.400 órdenes | Done |
| PZ-PERF-003 | Listados relacionales conservan dos consultas y evitan joins en count | HITO 15 | count raíz + findAll eager allowlisted | Bike/Order/History/Audit GET | query-count/SQL shape/regresión | Done |
| PZ-PERF-004 | Paginación operativa permanece acotada y determinista | HITO 15 | máximo 100 + desempate por ID | colecciones paginadas | páginas/empates/planes de índice | Done |
| PZ-UX-001 | Login retorna a la ruta completa y expiry termina seguro | HITO 17 | route state + refresh coordinator | sesión/rutas | return/failed refresh | Done |
| PZ-UX-002 | Logout pendiente bloquea doble envío | HITO 17 | mutation lock visible | navegación | pending logout | Done |
| PZ-UX-003 | Navegación SPA y búsquedas operan por teclado | HITO 17 | focus management + forms | vistas principales | keyboard cases | Done |
| PZ-UX-004 | Edición de maestras recupera fallos con retry | HITO 17 | load states conservan ruta | edit pages | retry cases | Done |
| PZ-UX-005 | Conflicto de placa enlaza a la maestra correcta | HITO 17 | error action con lifecycle | new order/bikes | recovery flow | Done |
| PZ-UX-006 | Relaciones son navegables por nombres y placas | HITO 17 | links semánticos | detalle orden | navigation case | Done |
| PZ-UX-007 | Layout conserva operación en tablet/móvil | HITO 17 | breakpoints y focus visible | shell/vistas | responsive contract | Done |
| PZ-MIG-001 | Base vacía aplica/revierte 14 migraciones | HITO 18 | Umzug ESM | persistencia | schema lifecycle | Done |
| PZ-MIG-002 | Filas legacy sobreviven upgrade/down/reapply 008–014 | HITO 18 | migraciones compatibles | persistencia | populated upgrade | Done |
| PZ-MIG-003 | Contactos preflightan y canonicalizan atómicamente | HITO 18 | migración `012` | persistencia | valid/invalid/reapply | Done |
| PZ-MIG-004 | Guard de orden abierta exige corrección humana | HITO 18 | migración `013` | persistencia | preflight cases | Done |
| PZ-MIG-005 | Índices operativos tienen down/reapply sin pérdida | HITO 18 | migración `014` | persistencia | index lifecycle | Done |
| P0-DEMO-001 | Seed demo opcional, íntegro, idempotente y no productivo | Extensión opcional aprobada | `seedDemoData`, marcador reservado y transacción | `npm run db:seed:demo` | `demoSeed.integration.test.js` | Done |

## Regla de mantenimiento

Cada cambio debe actualizar implementación, prueba y trazabilidad en el mismo hito. Los requisitos fuente y extensiones del contrato permanecen distinguibles en “Fase fuente”.
