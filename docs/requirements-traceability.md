# Trazabilidad de requisitos

## Leyenda

- `Foundation`: arquitectura, tooling o contrato establecido como fundamento; no representa una feature de negocio pendiente.
- `Pending`: implementación/evidencia aún no realizada.
- `Done`: comportamiento implementado con evidencia aprobada.

La tabla contiene 111 requisitos: 105 `Done` y 6 `Foundation`. No existen filas `Pending`. La matriz detallada requisito → riesgo → caso está en [test-acceptance-matrix.md](test-acceptance-matrix.md).

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
| P0-DEMO-001 | Seed demo opcional, íntegro, idempotente y no productivo | Extensión opcional aprobada | `seedDemoData`, marcador reservado y transacción | `npm run db:seed:demo` | `demoSeed.integration.test.js` | Done |

## Regla de mantenimiento

Cada cambio debe actualizar implementación, prueba y trazabilidad en el mismo hito. Los requisitos fuente y extensiones del contrato permanecen distinguibles en “Fase fuente”.
