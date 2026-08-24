# Testing Strategy

## Foundation baseline

- Backend: Vitest + Supertest verifies `GET /api/health` and the technical 404 envelope.
- Frontend: Vitest + React Testing Library renders `App` in a router context.
- ESLint runs independently in each package.
- Domain behavior is added only by its approved milestone suites.

Vitest is used for both packages to keep foundation tooling small and consistent. Supertest still exercises Express without binding a network port. This is a tooling choice, not an architectural change; later suites remain integration-focused.

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

Planned lifecycle:

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
- applies all four migrations;
- verifies Sequelize associations with a nested persistence query;
- verifies normalized UNIQUE plate behavior;
- verifies Bike→Client, WorkOrder→Bike and WorkOrderItem→WorkOrder foreign keys;
- bypasses model validation deliberately to prove MySQL enforces both CHECK constraints;
- reloads DECIMAL values as strings to prove no JavaScript float conversion;
- verifies contractual ENUM values;
- reverts every migration, confirms the tables are absent and reapplies the stack;
- removes domain data/reverts migrations and closes the connection in teardown.

The four schema files run sequentially because they intentionally share one migration database. Ordinary HTTP tests remain independent.

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

## Critical future suites

Later milestones must cover the full matrix in `AGENTS.md`: authentication and token-family reuse, RBAC, clients/bikes, order filters and pagination, item totals, all state transitions, concurrent mutations, audit contents/order/pagination and ADMIN user management.

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
