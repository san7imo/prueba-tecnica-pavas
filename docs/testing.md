# Testing Strategy

## Foundation baseline

- Backend: Vitest + Supertest verifies `GET /api/health` and the technical 404 envelope.
- Frontend: Vitest + React Testing Library verifies operational workflows, authenticated routing, session behavior and role-aware UI in router contexts.
- ESLint runs independently in each package.
- Domain behavior is added only by its approved milestone suites.

Vitest is used for both packages to keep foundation tooling small and consistent. Supertest still exercises Express without binding a network port. This is a tooling choice, not an architectural change; later suites remain integration-focused.

## HITO 12 acceptance strategy

Acceptance is requirement-driven, not percentage-driven. The executable inventory is 14 backend suites/192 tests and 10 frontend suites/45 tests. The complete mapping from requirement and risk to named evidence is maintained in [test-acceptance-matrix.md](test-acceptance-matrix.md).

The audit sequence is:

```text
Phase 1 + Phase 2 + AGENTS.md
  → requirements traceability
  → named automated evidence
  → focused missing tests
  → full regression
  → repeated concurrency/order tests
  → real browser/API acceptance smoke
```

Coverage percentage is deliberately not an acceptance criterion. Persistence/HTTP/component tests overlap only where they prove different boundaries, such as request validation versus a physical MySQL constraint.

## HITO 6 frontend suite

Frontend tests mock the narrow resource API modules, not React components. This keeps tests deterministic while exercising page state, routing, forms and user-visible outcomes.

Coverage includes:

- application shell, `/orders` route and friendly unknown-route handling;
- list loading, empty, populated and API-error/retry states;
- status/plate filter requests and metadata-driven pagination;
- existing-bike lookup, automatic selection, exact order payload and navigation;
- missing-bike flow with sequential quick Client/Bike registration;
- backend error display and duplicate-submission locks;
- detail loading/not-found, related resources, items and authoritative total;
- exact decimal-string subtotal/COP presentation without float arithmetic;
- item add/delete, destructive confirmation and detail refetch;
- valid state actions only, cancellation confirmation, terminal states and backend transition errors;
- API-module envelope/query/status-body contracts.

These Phase 1 cases remain regression coverage and now supply an explicit test authentication context when a route-level provider is not under test.

## HITO 10 frontend suite

The Phase 2 frontend suite exercises production session and routing behavior without a bypass:

- refresh-based bootstrap loading, successful restoration, anonymous fallback and cleanup after failed logout;
- login validation, protected-route redirect, authenticated `/login` redirect and ADMIN-only route behavior;
- in-memory Bearer attachment and a strict one-retry limit;
- five concurrent 401 failures resolved through exactly one refresh request and five successful retries;
- ADMIN navigation and user list/create/role/active interactions, including deactivation confirmation and absence of delete controls;
- MECANICO visibility rules for item deletion, delivery, cancellation and intermediate actions;
- optional transition note transport plus authoritative order/history refetch;
- history loading, newest-first rendering, actor/from/to/note/initial-event display, pagination, retry and empty states.

Resource modules are mocked at the network boundary for component tests. The Axios concurrency suite exercises the real interceptors with a deterministic adapter, and application tests mount the real `AuthProvider` and route table.

## Dedicated integration database

Integration suites must use MySQL database `pavas_workshop_test` (or the configured `DB_NAME_TEST`). Development uses `pavas_workshop`.

Mandatory safeguards:

- run integration suites with `NODE_ENV=test`;
- resolve the database name from `DB_NAME_TEST`;
- refuse destructive setup when `NODE_ENV=production` or when the target is not explicitly identified as a test database;
- never reuse production credentials;
- run migrations before integration tests;
- keep fixtures deterministic;
- do not run demo seeds implicitly;
- isolate or reset state between tests;
- close Sequelize connections after the suite;
- ensure test order does not affect outcomes.

Implemented lifecycle:

```text
beforeAll: connect to dedicated test DB and apply migrations
beforeEach/helper: reset relevant tables or create isolated fixtures
tests
afterAll: close database connections
```

Transaction rollback may isolate ordinary tests. Concurrency tests need committed rows and separate connections, so they require deterministic cleanup instead of a single enclosing transaction.

## HITO 1 persistence suite

`tests/schema.integration.test.js` now performs the Phase 1 schema verification against MySQL:

- asserts `NODE_ENV=test` and `DB_NAME_TEST` selection;
- refuses development/production destructive setup through `testDatabaseGuard`;
- starts from a reverted migration stack;
- applies all seven migrations;
- verifies Sequelize associations with a nested persistence query;
- verifies normalized UNIQUE plate behavior;
- verifies domain, audit and identity associations plus physical foreign keys;
- bypasses model validation deliberately to prove MySQL enforces both CHECK constraints;
- reloads DECIMAL values as strings to prove no JavaScript float conversion;
- verifies contractual ENUM values and the exact audit column set;
- verifies the physical descending audit index and both audit `RESTRICT` foreign keys;
- reverts every migration, confirms the tables are absent and reapplies the stack;
- removes domain data/reverts migrations and closes the connection in teardown.

All MySQL integration files run sequentially because they intentionally share one migration database. Ordinary test cases within each HTTP suite remain isolated by deterministic cleanup.

The backend Vitest hook timeout is 30 seconds because every integration file deliberately exercises a seven-migration MySQL down/up lifecycle; file parallelism remains disabled so suites cannot mutate the shared schema concurrently.

## HITO 2 Client/Bike HTTP suite

`tests/clientsBikes.integration.test.js` exercises the real Express request flow through MySQL. Its suite uses the guarded test database, reverts/applies all migrations before execution, removes dependent domain rows before each test, reverts migrations afterward and closes its Sequelize pool.

Coverage includes:

- valid client creation, optional email, normalization, field whitelisting and required/invalid inputs;
- unfiltered client listing and partial name/phone/email searches, including empty results;
- client detail, not-found and invalid-ID behavior;
- valid bike creation, optional cylinder, nested client serialization and plate normalization;
- exact/case/space-equivalent duplicate plates returning 409;
- missing client and required bike-field behavior;
- unfiltered bike listing and normalized partial plate searches;
- bike detail, not-found and invalid-ID behavior.

The existing direct persistence test continues to prove that MySQL's `uq_bikes_plate` constraint is the final barrier independently of the application pre-check.

## HITO 3 WorkOrder HTTP suite

`tests/workOrders.integration.test.js` uses the same guarded migration lifecycle and deterministic cleanup. It covers:

- valid creation and missing Bike handling;
- required fields, explicit/invalid/omitted entry dates and server-time default;
- enforced `RECIBIDA`/`0.00` defaults and mass-assignment protection;
- empty and populated lists with eager Bike/Client data;
- contractual status and normalized exact/lowercase/spaced/partial plate filters;
- combined filters, pagination validation/metadata and stable `entryDate DESC, id DESC` ordering;
- detail graphs containing Bike, Client and existing WorkOrderItem rows;
- validation and not-found errors;
- a query-hook assertion proving list query count remains two (count + page data) for multiple orders, with no per-row reads.

Tests may insert non-`RECIBIDA` states directly as deterministic read fixtures. HITO 3 itself did not mutate statuses; the dedicated HITO 5 suite below now owns that HTTP behavior.

## HITO 4 item/total HTTP suite

`tests/workOrders.integration.test.js` now also exercises the two item endpoints through Express and the dedicated MySQL test database. Coverage includes:

- both item types, fractional quantities, zero unit value and explicit response contracts;
- missing/invalid fields, decimal scale/range, missing orders/items and mass-assignment protection;
- the canonical `2 × 50,000 + 1 × 30,000 = 130,000` calculation;
- exact `0.10 + 0.20 = 0.30` behavior without JavaScript monetary arithmetic;
- deletion recalc, detail regression and final-item `0.00` behavior;
- an injected repository failure after insertion that proves the real database transaction rolls the item and total back together without production-only hooks;
- two concurrent HTTP additions using distinct transactions, with SQL evidence of two `START TRANSACTION` and two WorkOrder `FOR UPDATE` reads;
- a concurrent create/delete race that verifies the remaining row and stored total stay consistent.

Concurrency fixtures are committed before the requests and the requests run through separate pooled connections. Deterministic table cleanup is used rather than a suite-wide rollback transaction.

## HITO 5 state-machine HTTP suite

`tests/workOrderStatus.integration.test.js` exercises the status endpoint through Express and the dedicated MySQL database. It covers:

- the complete forward workflow while checking persisted status after every transition;
- cancellation from `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO` and `LISTA`;
- an explicit 6 × 6 matrix comparing every current/target pair against the contractual graph, including every same-state request;
- terminal-state, unknown-target, malformed body/ID, missing-order and stable error behavior;
- normalized/null note handling with transactional history persistence;
- rollback and safe error serialization on a forced repository failure;
- preservation of item total during status changes;
- a concurrent serially valid `RECIBIDA → DIAGNOSTICO/CANCELADA` scenario;
- a competing `LISTA → ENTREGADA/CANCELADA` race that produces exactly one success and one HTTP 400.

The terminal race captures SQL evidence of two independent transactions and two WorkOrder `FOR UPDATE` reads. Its losing response names the terminal state committed by the winner, proving revalidation occurred after the lock rather than against stale `LISTA` state.

## HITO 9 audit-history suite

`tests/workOrderHistory.integration.test.js` exercises the audit contract through Express and MySQL. It covers:

- exactly one initial `NULL -> RECIBIDA` event using the authenticated creator and null note;
- creation rollback when the initial audit insert fails;
- actor, timestamp, from/to, trimmed note and cancellation content;
- zero rows after invalid, same-state, terminal or MECANICO-forbidden attempts;
- transition rollback when the history insert fails after the status update;
- ADMIN/MECANICO read access, unauthenticated 401, missing-parent 404 and safe actor serialization;
- strict ID/page/pageSize validation and the page-size maximum of 100;
- 150 timestamp-tied rows split exactly 100/50 and ordered by descending ID;
- two concurrent same-target requests producing one 200, one 400 and exactly one history row.

`tests/schema.integration.test.js` additionally verifies the physical `(work_order_id ASC, created_at DESC, id DESC)` metadata, exact immutable column set, both foreign keys and populated migration down/up. The bounded read performs one parent check, one count and one paginated actor join; no query is issued per history row.

The 2026-08-24 local HITO 9 verification observed **9.40 ms** for the complete authenticated HTTP request returning a 100-row page from 150 tied events on the Docker MySQL 8.4 test environment. `EXPLAIN` selected `ix_work_order_status_history_order_created_id` for the history table; the actor join still reported a bounded temporary/filesort step. With a hard maximum of 100 returned rows and the measured result well below the source target, no raw-SQL hint or extra infrastructure is justified. This observation is assessment-scale evidence, not a production SLA.

## HITO 11 security suite

`tests/security.test.js` verifies representative Helmet headers, the documented API-only CSP decision, absence of Express disclosure/non-production HSTS, exact allowed-origin credentials, denied origins, no-Origin clients, preflight, the 100 KiB JSON boundary, malformed JSON and sanitized unexpected exceptions. `tests/applicationConfig.test.js` covers environment/origin startup invariants; `tests/authConfig.test.js` retains secret, lifetime and production-cookie failures.

`tests/auth.integration.test.js` additionally proves access/refresh tokens cannot cross purpose boundaries, non-HS256 access JWTs fail, credentialed CORS survives login → refresh → protected business request → logout, and cookie clearing preserves the set-cookie scope/security attributes. The existing rate-limit and RBAC suites remain regression evidence. Frontend tests/build prove hardening did not change memory-only token storage or authenticated UX.

HITO 12 still owns the final submission-wide matrix; HITO 11 does not replace it.

## HITO 7 authentication suite

`tests/auth.integration.test.js` applies the full migration stack to guarded MySQL and covers bcrypt storage/cost/comparison, normalized ADMIN and MECANICO login, generic failures, safe payloads, access claims, `/me`, missing/malformed/expired/wrong-signature/stale-user/inactive-user access, HttpOnly cookie properties, digest-only persistence, refresh expiry/invalidity, rotation links, family-scoped replay revocation, independent families, idempotent logout, login HTTP 429 and idempotent ADMIN seed behavior.

The concurrent-refresh test sends two requests with the same token through separate transactions. The token-row `FOR UPDATE` lock permits exactly one rotation; the waiter detects the committed replacement, revokes that family and leaves zero active descendants. This intentionally conservative outcome treats simultaneous second use as possible theft.

## HITO 8 RBAC and user-administration suite

`tests/rbac.integration.test.js` covers unauthenticated/invalid/inactive 401 boundaries; ADMIN/MECANICO access to Client, Bike and WorkOrder create/read; item add for both roles and delete only for ADMIN; registration of both roles, mass-assignment protection, password minimum and normalized duplicate 409; safe ADMIN user listing; role/active validation, 404 and 403 paths; immediate invalidation of old tokens; all MECANICO intermediate transitions; forbidden delivery/cancellation; ADMIN terminal transitions; and the 400 workflow versus 403 permission distinction.

`tests/authorize.test.js` verifies the middleware's direct 401/403/pass behavior. Existing HITO 2–5 HTTP suites use a shared helper that creates a real persisted ADMIN and signed access JWT, so their original domain assertions continue through the production authentication middleware rather than a bypass. Protected list-query evidence now expects one user-auth lookup plus the same two count/data queries.

Passing existing tests alone is insufficient at release: each traceability row and HITO 12 matrix entry must point to a concrete passing test.

## Commands

```bash
cd backend
DB_PORT=3306 npm test
npm run lint

cd ../frontend
npm test
npm run lint
npm run build
```

If local port 3306 is occupied, expose Compose on another port and pass the same value, for example `DB_PORT=33306 npm test`.

Migration commands:

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:migrate:down
npm run db:migrate:test
npm run db:migrate:reset:test
```

The full reset command is intentionally test-only.

## Concurrency and repeatability

Critical races use committed fixtures and separate pooled connections rather than a synthetic single transaction:

- refresh/refresh locks the presented token row and treats the waiter as replay;
- item add/add and add/delete share the WorkOrder lock and compare persisted `SUM` with `WorkOrder.total`;
- status races re-read the current state under `FOR UPDATE` and assert one legal outcome;
- competing same-target status requests assert exactly one new audit row;
- the 150-event history test fixes equal timestamps and proves the descending ID tie-break over two pages.

HITO 12 repeats these suites in fresh Vitest processes and records run/pass/failure totals in the milestone report. A small repeat count is intentional: this is concurrency regression evidence, not a load benchmark.

## Security regression tests

The security boundary is covered by the header/CORS/parser suite, startup configuration tests, auth/RBAC integration suites and safe 404/500 assertions. Cookie attributes are checked at login/logout; token purpose and algorithm boundaries are explicit; rate limiting is tested through the real login endpoint. Dependency findings are reviewed separately because an audit advisory is not equivalent to an exploitable application path.

## Browser and API acceptance smoke

Automated component tests remain the primary repeatable UI evidence. A real Chrome smoke complements them against running Vite, Express and MySQL processes. The HITO 12 scenario exercises an ADMIN creating Client → Bike → WorkOrder → two item types → total → three status changes → history → MECANICO, followed by the MECANICO read/item/permission/allowed-transition/logout flow.

Direct API sanity additionally samples the public status classes 401, 403, 400, 404, 409 and 429. These smoke checks do not replace their deterministic automated integration tests.

### HITO 12 local acceptance record — 2026-08-24

- backend full suite: 14/14 files, 192/192 tests;
- frontend full suite: 10/10 files, 45/45 tests;
- critical repeatability: 3 fresh runs, 7 selected cases per run, 21 passes and 0 failures;
- ADMIN browser flow: Client/Bike/two orders, REPUESTO + MANO_OBRA, persisted 130000 total, DIAGNOSTICO → EN_PROCESO → LISTA, actor-visible history and MECANICO creation;
- MECANICO browser flow: list/detail, item creation, allowed DIAGNOSTICO transition, next intermediate action visible, delete/cancel/deliver/users unavailable;
- API sanity: expected 401/403/400/404/409/429 envelopes observed;
- migration status before smoke: seven executed, zero pending;
- Postman collection: valid JSON, five top-level folders and 22 requests.

The browser profile and servers were temporary and removed/stopped after verification. Smoke fixtures never left `pavas_workshop_test`; afterward its schema was reverted/reapplied, all seven migrations were executed with zero pending, and all seven entity tables reported zero rows.

## HITO 13 UI and accessibility acceptance

HITO 13 keeps the existing component/API architecture and verifies polish through focused accessible-role assertions plus a real Chrome review. No visual-test dependency or retained screenshot fixture was added.

Automated evidence covers:

- required login controls and associated labels;
- labeled, keyboard-focusable order/item/user table regions;
- explicit role selection followed by a separate save action;
- operational status-action labels while preserving enum payloads;
- existing loading, error, empty, disabled, retry, confirmation and role-aware states.

### HITO 13 local acceptance record — 2026-08-24

- frontend lint: pass;
- frontend full suite: 10/10 files, 46/46 tests;
- frontend production build: 113 modules, 326.83 kB JavaScript (102.39 kB gzip) and no new dependency;
- backend lint: pass;
- backend regression: 14/14 files, 192/192 tests;
- desktop/tablet/mobile visual review: `/login`, `/orders`, `/orders/new`, ADMIN/MECANICO `/orders/:id` and ADMIN `/admin/users`;
- responsive widths: every audited 375 px view reported document width 375 px after the item table switched to a CSS card presentation below 640 px;
- keyboard: Tab/Shift+Tab login order, skip link as first application focus, Enter form submission, Space role-save activation and focusable table region verified;
- semantics: one `h1` per view, zero unlabeled form controls, zero untyped buttons and no raw ISO timestamps in audited views;
- contrast: primary/status combinations exceed 5.46:1; muted text is 4.97:1 and placeholders 4.65:1 on white;
- security/console: Web Storage remained empty and Chrome reported zero application errors, React warnings or duplicate-request symptoms during the final flow;
- role UX: ADMIN item/delete/deliver/cancel/user actions remained available while MECANICO retained add/intermediate-transition actions and no forbidden controls.

The browser flow also created an order, added items as both roles, executed allowed transitions, refreshed history, filtered with the keyboard, saved/restored a user role explicitly and logged both roles out. All data remained confined to the dedicated test database.

## Manual final acceptance

For a reviewer running the project manually:

1. start clean MySQL and apply all migrations;
2. seed an ADMIN and start backend/frontend;
3. perform the ADMIN and MECANICO scenario above;
4. verify stored total and newest-first audit history;
5. run both full suites, lint and frontend build;
6. validate the Postman collection and review dependency audits.

HITO 15 remains responsible for the final clean-install/release execution; HITO 12 only establishes the critical evidence gate.

## Known testing limitations

- Frontend component tests mock narrow API modules; real browser smoke covers the wiring but is not retained as a permanent browser-automation dependency.
- The login limiter is process-local, so its integration case assumes a fresh test process.
- Concurrency tests prove transactional ordering on the assessment MySQL setup, not throughput under production load.
- The existing 9.40 ms history observation is local assessment evidence, not a production SLA.
- No coverage plugin is installed because percentage alone would not demonstrate requirement acceptance.
