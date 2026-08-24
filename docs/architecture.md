# Architecture

## Status and scope

This document defines the target architecture. HITO 1 added the Phase 1 persistence models, HITO 2 added Client/Bike HTTP modules, HITO 3 added WorkOrder creation/list/detail and HITO 4 adds transactional item mutation and authoritative totals through the complete layered request flow. Status transitions and Phase 2 security controls remain unimplemented.

## Architectural Style

PAVAS Moto Workshop uses a **modular layered monolith**. The assessment covers one cohesive workshop domain, a modest number of entities and a single delivery unit. A monolith therefore provides fast delivery and straightforward transactions without sacrificing separation of responsibilities.

Microservices would add deployment, network, data-consistency and observability costs without solving an assessment requirement. Modules remain explicit so they can evolve independently inside one application.

## Backend request flow

```text
HTTP Request
     ↓
Route
     ↓
Validation Middleware
     ↓
Authentication / Authorization (Phase 2)
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

Authentication and authorization are shown to freeze the target flow but will not be implemented before Phase 2.

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

Multi-write business operations must be atomic. HITO 4 item-total mutations run through a service-owned Sequelize transaction and lock their target work-order row with `SELECT ... FOR UPDATE`. Create then inserts the item; delete resolves the immutable owning order, locks that order, revalidates the item with a locking read and removes it. Both paths aggregate persisted item rows and update the order before commit. This common order lock serializes competing create/create and create/delete operations. Audit insertion will occur in the same transaction as the status update in its later milestone.

MySQL performs the HITO 4 `SUM(count * unit_value)` using exact `DECIMAL` operands and casts the aggregate to `DECIMAL(15,2)`. The application carries the result as a string and never performs monetary arithmetic with JavaScript `Number`. See ADR-004.

## Database and migrations

MySQL 8 is the persistence engine and Sequelize is the mapper/query layer. HITO 1 implements deterministic ESM migrations through Umzug/`SequelizeMeta`; the application does not use `sequelize.sync` as a schema strategy.

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

## API conventions

- JSON only under `/api`.
- Single resources use `{ "data": {} }`.
- Paginated collections use `{ "data": [], "meta": {} }`; unpaginated Client/Bike collections use `{ "data": [] }`.
- Errors use `{ "error": { "code": "...", "message": "..." } }`.
- Validation may add safe `details`.
- History uses deterministic `created_at DESC, id DESC` ordering.

See [api.md](api.md).

## Work-order query strategy

The HITO 3 list uses one paginated Sequelize `findAndCountAll` operation with eager `WorkOrder → Bike → Client` includes. `distinct: true` keeps the order count correct if the include graph later introduces row multiplication. It executes one count and one data query, independent of result count, and therefore avoids N+1 reads.

Pagination defaults to page 1/page size 20 and rejects sizes above 100. Results use `entry_date DESC, id DESC`: entry date is the operational date shown by the assessment UI, while ID provides deterministic ordering for equal timestamps.

## Security architecture

The final security boundary lives on the backend. UI visibility is never authorization. Phase 2 adds bcrypt, signed short-lived access JWTs, rotating hashed refresh tokens in HttpOnly cookies, token-family replay response, restricted CORS, Helmet, request limits and login rate limiting.

HITO 0 only documents this target and prevents committed environment files; it does not claim these controls as active.

## Error handling

The HITO 0 base includes `AppError`, a 404 middleware and one error middleware. HITO 2 adds explicit validation, not-found and conflict errors while preserving the same centralized public envelope. Unexpected failures return a generic 500 response.

## Operational assumptions

- API and frontend are separately runnable processes in the monorepo.
- MySQL is the only required infrastructure service.
- No cache, queue, WebSocket or event bus is needed.
- The source `.docx` assessment files remain preserved at repository root.
