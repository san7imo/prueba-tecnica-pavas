# Critical Test Acceptance Matrix

## Purpose

This matrix is the HITO 12 release gate. It maps the mandatory Phase 1/Phase 2 behaviors and the repository's approved risk controls to concrete automated evidence. `PASS` means the named test was collected and passed in the complete HITO 12 suite; it does not mean a coverage-percentage target was used.

## Backend acceptance matrix

| ID | Requirement / Risk | Layer | Test file | Test case / evidence | Status |
|---|---|---|---|---|---|
| P2-AUTH-001 | Initial ADMIN is deterministic, bcrypt-hashed and idempotent | Backend integration | `auth.integration.test.js` | `seeds one idempotent ADMIN without exposing or storing plaintext` | PASS |
| P2-AUTH-003A | ADMIN/MECANICO login succeeds with minimal signed claims and no sensitive JSON | Backend integration | `auth.integration.test.js` | `logs in a valid ADMIN...`; `logs in a valid MECANICO...` | PASS |
| P2-AUTH-003B | Unknown email, wrong password and inactive user must be indistinguishable 401 responses | Backend integration | `auth.integration.test.js` | `returns one generic error for unknown email, wrong password and inactive user` | PASS |
| P2-AUTH-003C | Password storage uses bcrypt cost ≥10 and never serializes | Backend integration | `auth.integration.test.js` | `stores normalized users with bcrypt cost >= 10 and safe serialization` | PASS |
| P2-AUTH-004A | `/me` returns a safe active user; missing/malformed access is rejected | Backend integration | `auth.integration.test.js` | `returns the safe current user and rejects missing, malformed and invalid access tokens` | PASS |
| P2-AUTH-004B | Expired, wrong-signature, missing-user and inactive-user JWTs fail | Backend integration | `auth.integration.test.js` | `rejects expired, wrong-signature, missing-user and inactive-user access tokens` | PASS |
| P2-AUTH-004C | JWT algorithm and access/refresh purposes cannot cross boundaries | Backend integration | `auth.integration.test.js` | `enforces access/refresh token purpose and the configured JWT algorithm` | PASS |
| P2-AUTH-005A | Valid refresh rotates in one family and revokes its predecessor | Backend integration | `auth.integration.test.js` | `rotates a valid refresh token transactionally in the same family` | PASS |
| P2-AUTH-005B | Missing, invalid and expired refresh tokens cannot issue replacements | Backend integration | `auth.integration.test.js` | `rejects absent, invalid and expired refresh tokens without creating replacements` | PASS |
| P2-AUTH-007A | Reuse is detected and revokes every active descendant in that family | Backend integration | `auth.integration.test.js` | `detects rotated-token reuse, revokes that family and rejects its replacement` | PASS |
| P2-AUTH-007B | Replay in one session does not revoke an independent login family | Backend integration | `auth.integration.test.js` | `keeps an independent login family usable after replay in another family` | PASS |
| P2-AUTH-006 | Logout revokes only the current refresh token, clears its cookie and is idempotent | Backend integration | `auth.integration.test.js` | `logs out only the current session, clears the cookie and remains idempotent` | PASS |
| P2-AUTH-005C | Concurrent refresh cannot create two usable descendants | Backend concurrency | `auth.integration.test.js` | `serializes concurrent refreshes so only one rotates and replay leaves no active descendant` | PASS |
| P2-SEC-001 | Login abuse receives stable HTTP 429 | Backend integration | `auth.integration.test.js` | `rate limits the login endpoint with a stable 429 envelope` | PASS |
| P2-RBAC-001 | Missing, malformed and inactive-user access fails with 401 before validation details | Backend integration | `rbac.integration.test.js` | `returns 401 before validation for missing, malformed and inactive-user tokens` | PASS |
| P2-RBAC-002 | Authenticated wrong-role access fails with 403 | Backend unit/integration | `authorize.test.js`, `rbac.integration.test.js` | `returns 403 for an authenticated role outside the allowed set`; user/item boundaries | PASS |
| P2-RBAC-003A | ADMIN and MECANICO can create/read required business resources | Backend integration | `rbac.integration.test.js` | `allows ADMIN and MECANICO to create and read clients, bikes and work orders` | PASS |
| P2-RBAC-003B | Both roles can add items; only ADMIN can delete | Backend integration | `rbac.integration.test.js` | `allows both roles to add items but only ADMIN to delete them` | PASS |
| P2-RBAC-003C | MECANICO can execute DIAGNOSTICO, EN_PROCESO and LISTA | Backend integration | `rbac.integration.test.js` | `allows MECANICO intermediate transitions but forbids valid deliver/cancel targets` | PASS |
| P2-RBAC-004 | MECANICO cannot administer users, delete items, deliver or cancel | Backend integration | `rbac.integration.test.js` | registration/list/item/status 403 assertions | PASS |
| P2-RBAC-005 | Invalid workflow is 400; workflow-valid but forbidden target is 403 | Backend integration | `rbac.integration.test.js` | `keeps workflow validity separate from role permission and allows ADMIN terminal targets` | PASS |
| P2-USER-001 | ADMIN lists safe users; unauthenticated/mechanic callers fail | Backend integration | `rbac.integration.test.js` | `lists only safe users for ADMIN and returns 401/403 at the boundary` | PASS |
| P2-AUTH-002 | ADMIN registers both ADMIN and MECANICO; mass assignment is ignored | Backend integration | `rbac.integration.test.js` | `registers ADMIN and MECANICO users only through ADMIN` | PASS |
| P2-USER-005 | Exact and normalized duplicate emails return 409 | Backend integration | `rbac.integration.test.js` | `rejects duplicate and normalized duplicate emails with 409` | PASS |
| P2-USER-002 | Role update supports valid change and rejects invalid/missing/forbidden cases | Backend integration | `rbac.integration.test.js` | `changes roles for ADMIN and preserves validation/not-found/role semantics` | PASS |
| P2-USER-003 | Users can be deactivated/reactivated; invalid boolean and missing user fail | Backend integration | `rbac.integration.test.js` | `deactivates and reactivates users with strict boolean validation` | PASS |
| P2-USER-006 | Deactivation invalidates an existing access token immediately | Backend integration | `rbac.integration.test.js` | `immediately rejects an existing token after deactivation` | PASS |
| P2-USER-007 | Role change invalidates a stale-role access token immediately | Backend integration | `rbac.integration.test.js` | `immediately rejects an existing token after a role change` | PASS |
| P2-USER-004 | User payloads and persistence serialization omit password/hash/token fields | Backend integration | `auth.integration.test.js`, `rbac.integration.test.js` | safe serialization and deep payload assertions | PASS |
| P1-BE-001 | Client create validates required fields, optional email, invalid email and normalization | Backend integration | `clientsBikes.integration.test.js` | Client POST create/optional/required/invalid/normalization cases | PASS |
| P1-BE-002 | Client searches name, phone and email and returns a valid empty result | Backend integration | `clientsBikes.integration.test.js` | Client GET partial search matrix and no-match case | PASS |
| P1-BE-003 | Client detail returns resource; missing resource returns 404 | Backend integration | `clientsBikes.integration.test.js` | Client detail existing/missing/invalid-ID cases | PASS |
| P1-BE-004 | Bike create validates optional cylinder and valid Client relation | Backend integration | `clientsBikes.integration.test.js` | Bike POST normalized/optional/missing-client/required-field cases | PASS |
| P1-DATA-003A | Plate normalization rejects exact, case and whitespace duplicates with 409 | Backend integration | `clientsBikes.integration.test.js` | three duplicate-plate cases | PASS |
| P1-DATA-003B | Database UNIQUE remains the final normalized-plate barrier | Persistence integration | `schema.integration.test.js` | `normalizes plates and enforces their database uniqueness` | PASS |
| P1-BE-005 | Plate search supports partial, lowercase, whitespace and no-match queries | Backend integration | `clientsBikes.integration.test.js` | Bike GET search matrix | PASS |
| P1-BE-006 | Bike detail includes Client and returns 404 when absent | Backend integration | `clientsBikes.integration.test.js` | Bike detail existing/missing/invalid-ID cases | PASS |
| P1-BE-007A | Valid order uses Bike/fault/date, starts RECIBIDA/0.00 and blocks status/total mass assignment | Backend integration | `workOrders.integration.test.js` | valid create, explicit whitelist and default assertions | PASS |
| P1-BE-007B | Invalid Bike, missing fault/bike and invalid/ambiguous dates fail safely | Backend integration | `workOrders.integration.test.js` | WorkOrder POST validation/404 matrix | PASS |
| P1-BE-007C | Omitted entryDate uses bounded server time | Backend integration | `workOrders.integration.test.js` | `uses the current server time when entryDate is omitted` | PASS |
| P2-AUDIT-002A | Creation atomically records exactly one `NULL → RECIBIDA` event with creator/time/null note | Backend integration | `workOrderHistory.integration.test.js` | `creates exactly one NULL -> RECIBIDA event with the authenticated creator` | PASS |
| P2-AUDIT-002B | Initial history failure rolls back order creation | Backend integration | `workOrderHistory.integration.test.js` | `rolls back work-order creation when the initial history insert fails` | PASS |
| P1-BE-008 | Empty/list/status/normalized-plate/combined filters behave contractually | Backend integration | `workOrders.integration.test.js` | WorkOrder GET empty/list/filter matrix | PASS |
| P1-BE-009A | Default/custom pagination, metadata and totalPages are correct; values above 100 fail | Backend integration | `workOrders.integration.test.js` | pagination metadata plus invalid page/pageSize matrix | PASS |
| P1-BE-009B | Work-order ordering is `entryDate DESC, id DESC` | Backend integration | `workOrders.integration.test.js` | `orders deterministically by entryDate DESC then id DESC` | PASS |
| P1-BE-009C | List performs one auth plus count/data reads without N+1 | Backend integration | `workOrders.integration.test.js` | `uses one auth plus two count/list queries without N+1 reads` | PASS |
| P1-BE-010 | Detail returns WorkOrder/Bike/Client/items/total and a missing order returns 404 | Backend integration | `workOrders.integration.test.js` | WorkOrder detail graph and missing-ID cases | PASS |
| P1-BE-011A | REPUESTO/MANO_OBRA, integer/fractional count and zero unit value are accepted | Backend integration | `workOrders.integration.test.js` | `creates both item types...`; `supports fractional quantities and zero-value items exactly` | PASS |
| P1-BE-011B | Zero/negative/precision/range count, negative/precision/range unit value, type and description fail | Backend integration | `workOrders.integration.test.js` | item validation matrices | PASS |
| P1-BE-011C | Missing WorkOrder creates no item; internal fields cannot control item/total | Backend integration | `workOrders.integration.test.js` | missing-order and whitelist cases | PASS |
| P1-BE-013A | One/multiple items calculate canonical 130000 and exact 0.10 + 0.20 | Backend integration | `workOrders.integration.test.js` | item creation/decimal total cases | PASS |
| P1-BE-013B | Item insertion rolls back if total persistence fails | Backend integration | `workOrders.integration.test.js` | `rolls back the inserted item when total persistence fails` | PASS |
| P1-BE-012 | Existing/missing deletion recalculates multiple/last-item total to exact zero | Backend integration | `workOrders.integration.test.js` | WorkOrder item DELETE cases | PASS |
| P1-BE-014 | Concurrent add/add and add/delete preserve persisted SUM and WorkOrder.total | Backend concurrency | `workOrders.integration.test.js` | `serializes concurrent additions...`; `keeps create/delete races consistent...` | PASS |
| P1-STATE-001 | Complete forward path persists every valid state and preserves total | Backend integration | `workOrderStatus.integration.test.js` | `persists the complete forward path and leaves the total unchanged` | PASS |
| P1-STATE-002 | Cancellation is accepted from all four nonterminal workflow states | Backend integration | `workOrderStatus.integration.test.js` | four parameterized cancellation cases | PASS |
| P1-STATE-003 | Full 6×6 matrix rejects skips, backward, same-state and terminal transitions with 400 | Backend integration | `workOrderStatus.integration.test.js` | `enforces the complete six-by-six transition matrix` and terminal cases | PASS |
| P1-STATE-004 | Same-state has a stable clear business error; unknown state is request validation | Backend integration | `workOrderStatus.integration.test.js` | same-state and unknown-target cases | PASS |
| P1-STATE-005 | Competing transitions serialize; terminal race has one winner and no lost update | Backend concurrency | `workOrderStatus.integration.test.js` | diagnosis/cancellation and competing terminal race cases | PASS |
| P2-AUDIT-003 | Valid state change/cancellation stores exactly one actor/from/to/time/note event | Backend integration | `workOrderHistory.integration.test.js` | `records actor, from/to, trimmed note and cancellation once per valid change` | PASS |
| P2-AUDIT-004 | Invalid, idempotent, terminal and forbidden attempts create zero history | Backend integration | `workOrderHistory.integration.test.js` | four no-event parameterized cases | PASS |
| P2-AUDIT-009 | Status update rolls back if audit insertion fails | Backend integration | `workOrderHistory.integration.test.js` | `rolls back the status update when history persistence fails` | PASS |
| P2-AUDIT-005 | Both roles read safe newest-first history; actor serializer excludes sensitive data | Backend integration | `workOrderHistory.integration.test.js` | `allows both roles to read safe newest-first history...` | PASS |
| P2-AUDIT-007 | 150 tied rows paginate 100/50 with correct totals/pages and stable ID tie-break | Backend integration | `workOrderHistory.integration.test.js` | `paginates 150 tied events as 100/50 with deterministic id-desc ordering` | PASS |
| P2-AUDIT-006 | Physical index is `(work_order_id, created_at DESC, id DESC)` | Persistence integration | `schema.integration.test.js` | `defines the immutable audit columns and deterministic composite index physically` | PASS |
| P2-AUDIT-010 | Same-target race creates one state update and exactly one new audit row | Backend concurrency | `workOrderHistory.integration.test.js` | `serializes competing same-target requests to one change and one audit row` | PASS |
| P0-INF-003 | Unknown API route returns centralized safe 404 | Backend HTTP | `notFound.test.js` | `uses the centralized error envelope` | PASS |
| P2-SEC-002A | Helmet headers, no `X-Powered-By`, API CSP choice and environment-bounded HSTS | Backend HTTP/unit | `security.test.js` | HSTS and representative-header cases | PASS |
| P2-SEC-002B | Exact CORS origin/credentials, denied origin, preflight and no-Origin clients | Backend HTTP | `security.test.js` | four CORS cases plus auth flow integration | PASS |
| P2-SEC-002C | Malformed JSON is 400 and >100 KiB JSON is 413 | Backend HTTP | `security.test.js` | `maps malformed and oversized JSON to safe client errors` | PASS |
| P2-SEC-004 | Unexpected exceptions return generic safe 500 without stack/SQL/path leakage | Backend HTTP | `security.test.js` | `sanitizes unexpected exceptions without leaking implementation details` | PASS |
| P2-SEC-003 | Production origin/secret/cookie/lifetime misconfiguration fails validation | Backend unit | `applicationConfig.test.js`, `authConfig.test.js` | invalid production configuration matrices | PASS |
| P0-INF-005 | Destructive integration setup rejects production/development/non-test DB targets | Backend unit | `testDatabaseGuard.test.js` | complete safety-guard matrix | PASS |
| P1-DATA-SCHEMA | All seven migrations apply/revert/reapply with FKs, CHECKs, ENUMs and DECIMAL | Persistence integration | `schema.integration.test.js` | complete clean schema lifecycle and physical constraints | PASS |

## Frontend acceptance matrix

| ID | Requirement / Risk | Layer | Test file | Test case / evidence | Status |
|---|---|---|---|---|---|
| P2-FE-001A | Successful login redirects anonymous protected visitor; failure stays generic | Frontend integration | `App.test.jsx` | anonymous login success and credential-error cases | PASS |
| P2-FE-001B | Bootstrap handles unauthenticated and restored sessions without protected flash | Frontend integration | `App.test.jsx`, `AuthContext.test.jsx` | restore/loading and anonymous-bootstrap cases | PASS |
| P2-FE-001C | Anonymous → login, authenticated `/login` → orders, ADMIN allowed, MECANICO denied | Frontend integration | `App.test.jsx` | complete route-guard cases | PASS |
| P2-FE-002A | Access token is attached from memory and never written to Web Storage | Frontend unit | `httpClientAuth.test.js` | `attaches the in-memory access token to business requests` plus storage assertions | PASS |
| P2-FE-002B | 401 refreshes once and retries all five concurrent callers with the rotated token | Frontend unit | `httpClientAuth.test.js` | `coordinates five concurrent 401 responses through exactly one refresh` | PASS |
| P2-FE-002C | Refresh failure clears an established session and does not retry business request | Frontend unit | `httpClientAuth.test.js` | `clears an established session when refresh after a 401 fails` | PASS |
| P2-FE-002D | A request retries at most once | Frontend unit | `httpClientAuth.test.js` | `does not retry a request that already consumed its one refresh attempt` | PASS |
| P2-FE-002E | Stale refresh cannot restore a session after logout; logout clears after network failure | Frontend unit/integration | `httpClientAuth.test.js`, `AuthContext.test.jsx` | logout/refresh race and failed-logout cleanup cases | PASS |
| P2-FE-003A | ADMIN user page lists and creates users without delete functionality | Frontend integration | `UsersPage.test.jsx` | `lists users and creates a user without exposing delete operations` | PASS |
| P2-FE-003B | Role update requires explicit save; deactivation confirmation and activation are wired correctly | Frontend integration | `UsersPage.test.jsx` | role draft/save, deactivate and inactive-user activation cases | PASS |
| P2-FE-003C | User loading, list error/retry/empty and safe create-error/submit lock are visible | Frontend integration | `UsersPage.test.jsx` | loading/error/retry and failed-creation cases | PASS |
| P2-FE-004A | MECANICO sees add/intermediate state but no delete/deliver/cancel/users controls | Frontend integration | `WorkOrderDetailPage.test.jsx`, `App.test.jsx` | mechanic hidden-control, intermediate-transition and route cases | PASS |
| P2-FE-004B | ADMIN sees valid delete/cancel/transition controls and confirmations | Frontend integration | `WorkOrderDetailPage.test.jsx` | detail actions, mutations and cancellation-confirmation cases | PASS |
| P2-FE-005 | Timeline displays actor/from/to/note/null note/initial event plus loading/error/retry/pagination | Frontend integration | `HistoryTimeline.test.jsx` | render, pagination and retry/empty cases | PASS |
| P1-FE-001 | Orders list displays plate/client/status/date/total with loading/error/empty states | Frontend integration | `WorkOrdersPage.test.jsx` | loading/empty, populated render and retry cases | PASS |
| P1-FE-002 | Status/plate filters reset page and call the server with active filters | Frontend integration | `WorkOrdersPage.test.jsx` | `applies server filters, resets the page and paginates` | PASS |
| P1-FE-003 | Pagination requests the next backend page | Frontend integration | `WorkOrdersPage.test.jsx` | same filter/pagination interaction | PASS |
| P1-FE-004 | Existing-bike plate lookup selects a Bike and creates an order without status/total | Frontend integration | `NewWorkOrderPage.test.jsx` | existing-bike creation flow | PASS |
| P1-FE-005 | Missing-bike flow creates Client then Bike and automatically selects it | Frontend integration | `NewWorkOrderPage.test.jsx` | quick Client/Bike registration chain | PASS |
| P1-UX-002 | Duplicate order submission is blocked and API errors remain actionable | Frontend integration | `NewWorkOrderPage.test.jsx` | duplicate-submit and lookup-error cases | PASS |
| P1-FE-006 | Detail displays Client/Bike/fault/status/items/subtotals/authoritative total/loading/404 | Frontend integration | `WorkOrderDetailPage.test.jsx` | populated loading/detail and not-found cases | PASS |
| P1-FE-007 | Only valid state action is submitted with Phase 2 note; terminal UI has no actions | Frontend integration | `WorkOrderDetailPage.test.jsx`, `apiModules.test.js` | allowed transition, terminal and payload-shape cases | PASS |
| P1-FE-008 | Add/delete item uses confirmation and refetches authoritative total | Frontend integration | `WorkOrderDetailPage.test.jsx` | `adds and deletes items, refetching...` | PASS |
| P1-FE-009 | Decimal UI multiplication/rounding avoids floating-point monetary arithmetic | Frontend unit | `formatters.test.js` | exact multiplication and COP-format cases | PASS |
| P1-UX-003 | Required controls, labeled keyboard-focusable tables and role-aware operational actions remain accessible | Frontend integration | `App.test.jsx`, `WorkOrdersPage.test.jsx`, `WorkOrderDetailPage.test.jsx`, `UsersPage.test.jsx` | required-field and focusable-region assertions plus explicit role save | PASS |

## Non-functional and documentation evidence

| ID | Requirement / Risk | Layer | Evidence | Status |
|---|---|---|---|---|
| P1-DOC-001 | Backend/frontend install, lint, test and production build remain executable | Tooling | Full HITO 12 command log summarized in `testing.md` | PASS |
| P1-DOC-002 | Postman collection is valid JSON and represents implemented API | Delivery | JSON parser validation plus collection review | PASS |
| P2-AUDIT-008 | History `<1s` target under assessment-scale data | Integration observation | Existing 150-row authenticated request: 9.40 ms; indexed query plan documented in `testing.md` | PASS |
| P0-DOC-001 | Architecture/business/security/API decisions remain documented | Documentation | `architecture.md`, ADRs, `business-rules.md`, `security.md`, `api.md` | PASS |

## Maintenance rule

When behavior changes, update the implementation test and this matrix in the same milestone. A critical functional row may remain `PASS` only while its named automated evidence exists and the full suite passes. Manual smoke is supplementary and cannot replace a testable mandatory behavior.
