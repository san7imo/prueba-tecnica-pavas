# Testing Strategy

## HITO 0 baseline

- Backend: Vitest + Supertest verifies `GET /api/health` and the technical 404 envelope.
- Frontend: Vitest + React Testing Library renders `App` in a router context.
- ESLint runs independently in each package.
- No domain behavior is tested or claimed before implementation.

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

## Critical future suites

Later milestones must cover the full matrix in `AGENTS.md`: authentication and token-family reuse, RBAC, clients/bikes, order filters and pagination, item totals, all state transitions, concurrent mutations, audit contents/order/pagination and ADMIN user management.

Passing existing tests alone is insufficient at release: each traceability row and HITO 12 matrix entry must point to a concrete passing test.

## Commands

```bash
cd backend
npm test
npm run lint

cd ../frontend
npm test
npm run lint
npm run build
```

