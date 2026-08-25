# Architecture

## Status and scope

This document defines the target architecture. HITO 1–6 implement Phase 1; HITO 7 adds sessions; HITO 8 adds backend RBAC/user administration; HITO 9 adds the transactional audit ledger. Frontend authentication and history visualization remain assigned to HITO 10.

## Architectural Style

PAVAS Moto Workshop uses a **modular layered monolith**. The assessment covers one cohesive workshop domain, a modest number of entities and a single delivery unit. A monolith therefore provides fast delivery and straightforward transactions without sacrificing separation of responsibilities.

Microservices would add deployment, network, data-consistency and observability costs without solving an assessment requirement. Modules remain explicit so they can evolve independently inside one application.

## Backend request flow

```text
HTTP Request
     ↓
Route
     ↓
Authentication
     ↓
Authorization when role-restricted
     ↓
Validation Middleware
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
Sequelize
     ↓
MySQL
```

This security-first order applies to every protected endpoint so unauthorized callers receive 401/403 before validation details. Public health/login/refresh/logout skip the boundary; `/me` authenticates without a role restriction. Workflow-specific status authorization remains in the locked service after transition validation.

## Backend responsibilities

### Routes

Map URL and HTTP method, attach middleware and delegate to controllers. Routes contain no business rules.

### Controllers

Extract validated request data, invoke a service and map successful results to HTTP responses. Controllers do not mutate Sequelize models, calculate totals or decide transitions.

### Services

Own business rules, domain authorization, transactions and workflows spanning multiple writes. Work-order state and total rules have one authoritative service implementation.

### Repositories

Own reusable persistence queries, includes, filtering, pagination and row locking. Complex work-order graphs remain out of controllers and services.

### Models

Represent the schema, associations and persistence constraints. They provide safe serialization and never contain HTTP behavior.

### Validators

Validate external bodies, query strings and parameters before service execution. Database constraints remain a second line of defense.

### Middlewares

Centralize authentication, authorization, validation mapping, rate limiting, not-found behavior and HTTP error handling.

### Errors

Application errors carry a safe code, status and message. A single error middleware emits the public error envelope and prevents SQL, JWT, stack or secret disclosure.

## Transactions and concurrency

Multi-write business operations must be atomic. HITO 4 item-total mutations run through a service-owned Sequelize transaction and lock their target work-order row with `SELECT ... FOR UPDATE`. Create then inserts the item; delete resolves the immutable owning order, locks that order, revalidates the item with a locking read and removes it. Both paths aggregate persisted item rows and update the order before commit. This common order lock serializes competing create/create and create/delete operations.

MySQL performs the HITO 4 `SUM(count * unit_value)` using exact `DECIMAL` operands and casts the aggregate to `DECIMAL(15,2)`. The application carries the result as a string and never performs monetary arithmetic with JavaScript `Number`. See ADR-004.

HITO 9 extends the HITO 5 status transaction without changing its lock order: read WorkOrder `FOR UPDATE`, validate the graph, validate the actor, update status and insert one history row before commit. A waiting transition reads the winner's committed state, so two same-target requests yield one success, one HTTP 400 and exactly one audit row. Order creation likewise wraps the order and initial `NULL -> RECIBIDA` event in one transaction. See ADR-003.

History reads use a dedicated repository query with bounded limit/offset, a single eager actor join selecting only ID/name, and `created_at DESC, id DESC`. The physical `(work_order_id, created_at DESC, id DESC)` index supports filtering and ordering without N+1 reads.

## Database and migrations

MySQL 8 is the persistence engine and Sequelize is the mapper/query layer. HITO 1 implements deterministic ESM migrations through Umzug/`SequelizeMeta`; the application does not use `sequelize.sync` as a schema strategy.

HITO 7 extends the stack with User and RefreshToken; HITO 8 adds `UserService`/UserRepository without schema changes; HITO 9 adds the seventh migration and a narrow history repository. Auth/audit request flow remains layered: Route → security middleware → Validator → Controller → Service → Repository → Sequelize. Controllers serialize service results; transactions and domain authorization remain in services.

Development and integration tests use separate databases. See [testing.md](testing.md).

## Frontend architecture

The React application uses Vite and feature-oriented modules:

```text
App / routes
     ↓
Layouts and pages
     ↓
Feature components and hooks
     ↓
API clients
     ↓
Express API
```

Server data is held close to the consuming page or feature. Authentication will use a narrowly scoped context. Forms use local state unless later complexity justifies a small form library. Redux is not part of the initial architecture.

React Router owns navigation and future role guards. Axios provides a single HTTP client whose refresh behavior will be added during Phase 2.

HITO 6 implements this as:

```text
src/
├── api/                    one Axios client + resource modules
├── components/ui/          shared loading, error, empty and status states
├── constants/              display labels and transition map
├── features/workOrders/    focused workflow components and list hook
├── layouts/                application shell
├── pages/                  route-level orchestration and local state
├── routes/                 route table
└── utils/                  safe API errors and exact decimal presentation
```

The browser never supplies WorkOrder `status` or `total` during creation. Mutations refetch detail so the persisted backend total and status remain authoritative. Item subtotals are informational and use decimal-string/`BigInt` arithmetic rather than `Number`. The centralized frontend transition map improves the workflow but does not replace backend state validation.

For local development the Axios base defaults to `/api` and Vite proxies it to port 3000. `VITE_API_BASE_URL` can instead point to a deployed API; cross-origin production policy remains part of the approved security milestone.

## API conventions

- JSON only under `/api`.
- Single resources use `{ "data": {} }`.
- Paginated collections use `{ "data": [], "meta": {} }`; unpaginated Client/Bike collections use `{ "data": [] }`.
- Errors use `{ "error": { "code": "...", "message": "..." } }`.
- Validation may add safe `details`.
- History uses deterministic `created_at DESC, id DESC` ordering.

See [api.md](api.md).

## Work-order query strategy

The HITO 3 list uses one paginated Sequelize `findAndCountAll` operation with eager `WorkOrder → Bike → Client` includes. `distinct: true` keeps the order count correct if the include graph later introduces row multiplication. The protected HITO 8 request executes one active-user authentication query followed by one count and one data query, independent of result count, and therefore avoids N+1 reads.

Pagination defaults to page 1/page size 20 and rejects sizes above 100. Results use `entry_date DESC, id DESC`: entry date is the operational date shown by the assessment UI, while ID provides deterministic ordering for equal timestamps.

## Security architecture

The security boundary lives on the backend. HITO 7 implements bcrypt, short-lived signed access JWTs, database-checked active users, hashed rotating refresh tokens in HttpOnly cookies, family-scoped replay response and a login-specific rate limiter. Refresh rotation locks the presented token row in a transaction; replay revocation commits before the public 401 response. See ADR-002 and [security.md](security.md).

UI visibility is never authorization. HITO 8 protects every business route and enforces ADMIN/MECANICO boundaries in middleware plus the status service. Restricted CORS, Helmet and the global production hardening review remain HITO 11.

## Error handling

The HITO 0 base includes `AppError`, a 404 middleware and one error middleware. HITO 2 adds explicit validation, not-found and conflict errors while preserving the same centralized public envelope. Unexpected failures return a generic 500 response.

## Operational assumptions

- API and frontend are separately runnable processes in the monorepo.
- MySQL is the only required infrastructure service.
- No cache, queue, WebSocket or event bus is needed.
- The source `.docx` assessment files remain preserved at repository root.
