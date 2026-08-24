# Requirements Traceability

## Status legend

- **Foundation:** architecture/tooling or contract is established in HITO 0; business behavior is not implemented.
- **Pending:** implementation and automated evidence belong to a later milestone.
- **Done:** reserved for implemented behavior with passing evidence.

All mandatory Phase 1 requirements and the approved HITO 7 authentication/session requirements are Done. RBAC, user administration, audit and Phase 2 frontend requirements remain pending.

| ID | Requirement | Phase | Implementation | Endpoint/UI | Automated Test | Status |
|---|---|---|---|---|---|---|
| P0-INF-001 | Node/Express backend boots | Foundation | `backend/server.js`, `src/app.js` | `GET /api/health` | `tests/health.test.js` | Foundation |
| P0-INF-002 | React frontend boots/builds | Foundation | Vite React application shell | `/orders` | `tests/App.test.jsx` + production build | Done |
| P0-INF-003 | Central technical error handling | Foundation | `AppError`, 404 and error middleware | Error envelope | `tests/notFound.test.js` | Foundation |
| P0-INF-004 | MySQL reproducible locally | Foundation | `docker-compose.yml` | N/A | Compose health verification | Foundation |
| P0-INF-005 | Dedicated test DB strategy | Foundation | `testDatabaseGuard.js`, `DB_NAME_TEST`, Umzug | N/A | Guard + schema integration suite | Done |
| P0-DOC-001 | Modular monolith documented | Foundation | `docs/architecture.md`, ADR-001 | N/A | Documentation review | Foundation |
| P0-DOC-002 | Full ER model documented | Foundation | `docs/database.md` | N/A | Documentation review | Foundation |
| P0-DOC-003 | API/error conventions documented | Foundation | `docs/api.md` | `/api` | Documentation review | Foundation |
| P1-DATA-001 | Client entity and Client 1:N Bike | 1 | Client model/migration + association | N/A | `schema.integration.test.js` | Done |
| P1-DATA-002 | Bike entity with valid Client FK | 1 | Bike model/migration + `fk_bikes_client` | N/A | FK + association tests | Done |
| P1-DATA-003 | Plate normalization and two-level uniqueness | 1 | Bike validator/service/setter + `uq_bikes_plate` | `POST /api/bikes` | HTTP normalized duplicate matrix + schema constraint test | Done |
| P1-DATA-004 | WorkOrder entity with valid Bike FK | 1 | WorkOrder model/migration + `fk_work_orders_bike` | Persistence layer | FK + association tests | Done |
| P1-DATA-005 | WorkOrderItem entity and relationship | 1 | Item model/migration + `fk_work_order_items_order` | Persistence layer | FK + association tests | Done |
| P1-DATA-006 | Item count greater than zero | 1 | Exact request/model validator + MySQL CHECK | Items API + persistence | HTTP zero/negative/scale/range + DB rejection tests | Done |
| P1-DATA-007 | Item unit value greater/equal zero | 1 | Exact request/model validator + MySQL CHECK | Items API + persistence | HTTP negative/scale/range/zero + DB rejection tests | Done |
| P1-DATA-008 | Money uses DECIMAL | 1 | `DECIMAL(15,2)` migration/models | Persistence layer | Reloaded exact DECIMAL test | Done |
| P1-BE-001 | Create client | 1 | Client route/validator/controller/service/repository | `POST /api/clients` | `clientsBikes.integration.test.js` create/validation tests | Done |
| P1-BE-002 | Search clients | 1 | Parameterized Client repository partial search | `GET /api/clients?search=` | Unfiltered + name/phone/email/empty tests | Done |
| P1-BE-003 | Get client detail | 1 | Client service not-found boundary + repository | `GET /api/clients/:id` | Existing/404/invalid-ID tests | Done |
| P1-BE-004 | Create bike | 1 | Bike layered module, client validation and conflict mapping | `POST /api/bikes` | Create/optional/validation/FK/duplicate tests | Done |
| P1-BE-005 | Search bikes by plate | 1 | Normalized partial Bike repository search | `GET /api/bikes?plate=` | Unfiltered/lowercase/spaces/empty tests | Done |
| P1-BE-006 | Get bike detail | 1 | Bike detail repository include + service not-found | `GET /api/bikes/:id` | Existing/client/404/invalid-ID tests | Done |
| P1-BE-007 | Create order only for valid bike, initial `RECIBIDA` | 1 | WorkOrder validator/service/repository with backend defaults | `POST /api/work-orders` | `workOrders.integration.test.js` create/default/FK tests | Done |
| P1-BE-008 | List/filter orders by status and plate | 1 | WorkOrder eager query with validated combined filters | `GET /api/work-orders` | Status/plate/combined/N+1 tests | Done |
| P1-BE-009 | Paginate work orders with metadata | 1 | `findAndCountAll`, max 100, stable entry-date/ID order | `GET /api/work-orders` | Defaults/invalid/page/meta/order tests | Done |
| P1-BE-010 | Get order with client, bike and items | 1 | WorkOrder detail include graph + explicit serializer | `GET /api/work-orders/:id` | Detail graph/404/invalid-ID tests | Done |
| P1-BE-011 | Add MANO_OBRA/REPUESTO item | 1 | Item validator/controller/service/repository with explicit fields | `POST /api/work-orders/:id/items` | Creation/type/validation/404 tests in `workOrders.integration.test.js` | Done |
| P1-BE-012 | Delete work-order item | 1 | Transactional item service with locked revalidation | `DELETE /api/work-orders/items/:itemId` | Delete/last-item/404/invalid-ID tests | Done |
| P1-BE-013 | Backend calculates total after add/delete | 1 | MySQL DECIMAL aggregate + persisted server-controlled total, ADR-004 | Order detail/items | 130000, 0.30, rollback and delete-total tests | Done |
| P1-BE-014 | Concurrent item mutations preserve total | Project contract | Service transactions + WorkOrder `FOR UPDATE` lock | Items API | Independent add/add transactions and add/delete race tests | Done |
| P1-STATE-001 | Canonical forward state flow | 1 | Central transition map + transactional WorkOrder service | `PATCH /api/work-orders/:id/status` | Full path and 6×6 matrix in `workOrderStatus.integration.test.js` | Done |
| P1-STATE-002 | Cancel from RECIBIDA/DIAGNOSTICO/EN_PROCESO/LISTA | 1 | Explicit cancellation edges in domain utility | Status endpoint | Four-state cancellation matrix | Done |
| P1-STATE-003 | ENTREGADA and CANCELADA terminal | 1 | Empty terminal transition sets, no rollback | Status endpoint | Terminal rows in complete matrix + explicit tests | Done |
| P1-STATE-004 | Invalid/idempotent transition returns clear 400 | 1/2 | `BusinessRuleError` with stable `INVALID_STATUS_TRANSITION` | Status endpoint | Known-invalid, same-state and unknown-state distinction | Done |
| P1-STATE-005 | Concurrent transitions are serialized | Project contract | Service transaction + shared WorkOrder `FOR UPDATE` repository query | Status endpoint | Serial-valid race + mutually exclusive terminal race | Done |
| P1-FE-001 | Work-order list table: plate/client/status/date/total | 1 | `WorkOrdersPage`, `OrderTable`, localized formatters and `StatusBadge` | `/orders` | `WorkOrdersPage.test.jsx` rendering test | Done |
| P1-FE-002 | Status and plate filters | 1 | Controlled `OrderFilters` + server query through `workOrdersApi` | `/orders` | Filter request/trim/reset interaction test | Done |
| P1-FE-003 | Work-order pagination | 1 | Backend metadata-driven `Pagination` | `/orders` | Next-page request and disabled boundary test | Done |
| P1-FE-004 | Create order selecting bike by plate | 1 | `BikeLookup`, local workflow state and explicit create payload | `/orders/new` | Existing-bike creation/navigation test | Done |
| P1-FE-005 | Quick client and bike registration | 1 | Sequential `QuickRegistration`, Client/Bike API modules and automatic selection | `/orders/new` | Full client→bike chain test | Done |
| P1-FE-006 | Detail shows client, bike, items and total | 1 | `WorkOrderDetailPage`, resource cards and exact decimal presentation | `/orders/:id` | Detail/related data/items/subtotal/total rendering test | Done |
| P1-FE-007 | Detail exposes valid transition actions only | 1 | Central frontend transition map + `StatusActions`; backend remains authoritative | `/orders/:id` | Allowed/hidden/terminal/error tests | Done |
| P1-FE-008 | Detail manages items | 1 | Item form/table, delete confirmation and authoritative refetch after mutation | `/orders/:id` | Add/delete/payload/refetch tests | Done |
| P1-UX-001 | Clear errors and loading indicators | 1 | Shared loading/error panels plus scoped mutation feedback | Required views | List/detail/create loading and API error tests | Done |
| P1-UX-002 | Empty, disabled and duplicate-submit states | Project contract | Empty panels, submit locks, terminal state and responsive CSS system | Required views | Empty/retry/double-submit/terminal tests | Done |
| P1-DOC-001 | Source, migrations and setup README | 1 | Backend/frontend source, Sequelize migrations and current root README | Repository delivery | Clean migration, boot, build and E2E verification | Done |
| P1-DOC-002 | Postman collection | Project contract | Complete Phase 1 Client/Bike/Work Orders/Items/Status collection | Phase 1 API | Collection structure review + E2E API smoke | Done |
| P2-DATA-001 | User model with unique email, role and active | 2 | User model + `202608240005-create-users.js` | Auth APIs | Schema/auth integration tests | Done |
| P2-DATA-002 | Refresh tokens stored only as digests | Project option | RefreshToken model/migration + SHA-256 lookup | Refresh/logout | Persistence inspection test | Done |
| P2-AUTH-001 | Initial ADMIN seed | 2 | Idempotent env-driven `seedInitialAdmin` | Login | Seed/hash/idempotency test | Done |
| P2-AUTH-002 | ADMIN-only user registration | 2 | Planned auth/RBAC HITO 8 | `POST /api/auth/register` | ADMIN success, MECANICO 403 | Pending |
| P2-AUTH-003 | Generic login with bcrypt cost >=10 and signed JWT | 2 | AuthService + login validator/controller | `POST /api/auth/login` | Success/normalized/invalid/inactive tests | Done |
| P2-AUTH-004 | Authenticated current profile, safe payload | 2 | `authenticate` + DB active-user lookup | `GET /api/auth/me` | Bearer matrix + safe profile tests | Done |
| P2-AUTH-005 | Refresh rotation via HttpOnly cookie | Project option | Transactional AuthService rotation | `POST /api/auth/refresh` | Cookie/rotation/expiry/concurrency tests | Done |
| P2-AUTH-006 | Logout revokes refresh and clears cookie | Project option | Current-token transactional revocation | `POST /api/auth/logout` | Logout/idempotency/session-scope test | Done |
| P2-AUTH-007 | Rotated-token reuse revokes active family | Project contract | Family tracking + replay revocation | Refresh endpoint | Replay/independent-family/concurrency tests | Done |
| P2-RBAC-001 | All business endpoints require authentication | 2 | Planned middleware HITO 8 | All business endpoints | Missing token 401 tests | Pending |
| P2-RBAC-002 | Wrong role returns 403 | 2 | Planned authorize middleware | Restricted endpoints | Role boundary tests | Pending |
| P2-RBAC-003 | MECANICO may add items and move to three states | 2 | Planned service authorization | Items/status | Allowed action tests | Pending |
| P2-RBAC-004 | MECANICO cannot deliver, cancel or delete item | 2 | Planned service authorization | Items/status | Forbidden action tests | Pending |
| P2-USER-001 | ADMIN lists users | 2 | Planned UserService HITO 8 | `GET /api/users` | ADMIN/MECANICO tests | Pending |
| P2-USER-002 | ADMIN changes user role | 2 | Planned UserService HITO 8 | `PATCH /api/users/:id/role` | Update/validation tests | Pending |
| P2-USER-003 | ADMIN activates/deactivates users | 2 | Planned UserService HITO 8 | `PATCH /api/users/:id/active` | Update/inactive-login tests | Pending |
| P2-USER-004 | Password/hash never returned | 2 | Safe User model + explicit auth serializers/attributes | Auth APIs | Deep JSON payload/model assertions | Done |
| P2-AUDIT-001 | History schema with actor/from/to/note/time | 2 | Planned migration/model HITO 9 | History endpoint | Schema/content tests | Pending |
| P2-AUDIT-002 | Initial `NULL -> RECIBIDA` with creator | 2 interpretation | Planned creation transaction HITO 9 | Create/history | Initial audit test | Pending |
| P2-AUDIT-003 | Every valid change, including cancel, creates one row | 2 | Planned transition transaction | Status/history | Exact row-count tests | Pending |
| P2-AUDIT-004 | Rejected/idempotent changes create no history | 2 | Planned transition transaction | Status/history | Absence tests | Pending |
| P2-AUDIT-005 | History immutable and newest first | 2 | No mutation routes; ordered repository | History endpoint | Ordering tests | Pending |
| P2-AUDIT-006 | History index includes required source prefix | 2 | Planned migration HITO 9 | N/A | Index metadata test | Pending |
| P2-AUDIT-007 | History pagination, max 100 and stable tie order | 2 | Planned repository HITO 9 | `GET /api/work-orders/:id/history` | More-than-100 test | Pending |
| P2-AUDIT-008 | History display target under one second | 2 | Indexed bounded query + UI | Detail timeline | Local query-plan/performance check | Pending |
| P2-FE-001 | Login and protected/role routes | 2 | Planned HITO 10 | `/login`, protected views | Guard/login tests | Pending |
| P2-FE-002 | Session restore, renewal and logout | 2 | Planned AuthContext/Axios flow | Application shell | Refresh/recovery UI tests | Pending |
| P2-FE-003 | ADMIN user list/create/role/active UI | 2 | Planned HITO 10 | `/admin/users` | User-management UI tests | Pending |
| P2-FE-004 | Role-aware work-order actions | 2 | Planned HITO 10 | `/orders/:id` | MECANICO UI tests | Pending |
| P2-FE-005 | History timeline shows date/user/from/to/note | 2 | Planned HITO 10 | `/orders/:id` | Timeline rendering test | Pending |
| P2-SEC-001 | Login rate limiting | 2 | Dedicated configurable login limiter | `POST /api/auth/login` | Stable 429 endpoint test | Done |
| P2-SEC-002 | Helmet, restricted CORS and body limit | Project contract | Planned HITO 11 | API boundary | Security configuration tests | Pending |
| P2-SEC-003 | Secure cookie policy and secret validation | 2/project contract | HttpOnly/path/SameSite/Secure cookie + startup validator | Auth startup/cookies | Cookie and configuration tests | Done |
| P2-SEC-004 | No stack, SQL, JWT or secret leakage | Project contract | Planned error hardening | Error responses/logs | Sanitization tests | Pending |

## Maintenance rule

Every milestone must replace planned implementation/test references with concrete files and mark a row Done only after its automated evidence passes. Source requirements and project-contract enhancements remain distinguishable in the Phase column.
