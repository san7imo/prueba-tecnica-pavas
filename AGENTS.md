# AGENTS.md

# PAVAS Moto Workshop — Engineering Execution Contract

**Contract version:** 1.1 — corrected after pre-implementation assessment gap review

## 1. Purpose

This repository implements the technical assessment for **PAVAS S.A.S.** as a production-minded MVP for motorcycle workshop work-order management.

The goal is not to maximize technology count. The goal is to deliver a **complete, secure, maintainable, testable, traceable, and well-documented solution** that satisfies the requirements of Phase 1 and Phase 2 while demonstrating sound engineering judgment.

Codex must treat this file as the primary execution contract for the repository.

---

# 2. Non-Negotiable Principles

1. **Requirements first.**
   - Implement every mandatory requirement from Phase 1 before optional enhancements.
   - Implement every mandatory requirement from Phase 2 before optional enhancements.
   - Optional work is allowed only when it directly reinforces the requested scope.

2. **No overengineering.**
   - Do not introduce microservices, queues, Redis, Kafka, GraphQL, CQRS, event sourcing, Kubernetes, AI, WebSockets, or other unrelated infrastructure.
   - Do not introduce a library unless it solves a concrete requirement or improves maintainability/security without materially increasing complexity.

3. **Professional MVP, not prototype code.**
   - Clear layering.
   - Explicit business rules.
   - Transactional consistency.
   - Centralized error handling.
   - Security controls.
   - Automated tests for critical paths.
   - Reproducible setup.
   - Documentation of relevant decisions.

4. **Traceability is mandatory.**
   - Work must be implemented by milestones.
   - Each milestone must be independently verifiable.
   - Git commits must tell the development story.
   - Requirements must be traceable to implementation and tests.

5. **Do not silently change architecture.**
   - Architectural changes require:
     1. justification,
     2. impact analysis,
     3. ADR update or new ADR,
     4. explicit approval before implementation.

6. **Do not skip tests because functionality appears to work manually.**

7. **Do not advance to the next milestone until the current milestone acceptance checklist passes.**

8. **Do not refactor unrelated code while implementing a milestone.**
   - Keep changes scoped and reviewable.

9. **Do not modify requirements to make implementation easier.**

10. **When uncertain, prefer the simplest solution that fully preserves the business rule.**

---

# 3. Source Requirements

## Phase 1

Mandatory stack:

- Node.js
- Express
- MySQL
- React
- JavaScript ES6+
- React Router
- Axios
- Sequelize is accepted and will be used intentionally.

Minimum business entities:

- Client
- Bike
- WorkOrder
- WorkOrderItem

Required work-order state flow:

```text
RECIBIDA
  -> DIAGNOSTICO
  -> EN_PROCESO
  -> LISTA
  -> ENTREGADA
```

Cancellation:

- `CANCELADA` is allowed from any state except `ENTREGADA`.
- Invalid transitions return HTTP `400` with a clear message.

Minimum backend endpoints:

```text
POST   /api/clients
GET    /api/clients?search=
GET    /api/clients/:id

POST   /api/bikes
GET    /api/bikes?plate=
GET    /api/bikes/:id

POST   /api/work-orders
GET    /api/work-orders?status=&plate=&page=&pageSize=
GET    /api/work-orders/:id
PATCH  /api/work-orders/:id/status

POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
```

Minimum validations:

- bike plate is unique;
- a work order cannot be created without a valid bike;
- item count must be `> 0`;
- item unit value must be `>= 0`.

Minimum frontend screens:

1. Work-order list
2. Create work order
3. Work-order detail

Required UX:

- clear errors;
- loading indicators;
- filters;
- pagination;
- quick client/bike registration;
- valid state transitions only;
- item management;
- total calculation.

Required deliverables:

- backend source;
- frontend source;
- SQL script or Sequelize migrations;
- README with setup, environment variables, and execution instructions;
- Postman collection is optional in the source assessment but required by this project contract.

---

## Phase 2

Additional mandatory domain capability:

### Work-order status history

Required fields:

- id
- work_order_id
- from_status
- to_status
- note
- changed_by_user_id
- created_at

Required behavior:

- every valid state change creates a history record;
- cancellation is audited;
- idempotent transitions must not create audit rows;
- history is sorted newest first;
- invalid transitions remain HTTP `400`.

Required endpoint:

```text
GET /api/work-orders/:id/history?page=&pageSize=
```

History query contract:

- default `page=1`;
- default `pageSize=20`;
- maximum `pageSize=100`;
- response includes pagination metadata;
- ordering MUST be deterministic: `created_at DESC, id DESC`;
- implementation must be designed to satisfy the source requirement of displaying history in `<1s` under the assessment scope;
- an integration test with more than 100 history events is required.

Updated status endpoint body:

```json
{
  "toStatus": "EN_PROCESO",
  "note": "Optional note"
}
```

Frontend:

- history timeline or equivalent clear visualization.

### Authentication and authorization

Roles:

- `ADMIN`
- `MECANICO`

Required authentication endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Required user-administration endpoints supporting the Phase 2 ADMIN UI:

```text
GET   /api/users
PATCH /api/users/:id/role
PATCH /api/users/:id/active
```

All `/api/users*` endpoints are ADMIN-only.

The original assessment marks refresh/logout as optional. This repository intentionally implements them.

`POST /api/auth/register` is retained exactly because it is explicitly requested by the assessment, even though user creation is conceptually an administrative operation.

Minimum access policy:

#### ADMIN

Full application access.

#### MECANICO

May:

- create work-order items;
- move orders to:
  - DIAGNOSTICO
  - EN_PROCESO
  - LISTA

May not:

- deliver an order;
- cancel an order;
- administer users;
- delete order items unless a later explicitly approved rule changes this.

All business endpoints require authentication.

Security requirements:

- bcrypt password hashing with cost >= 10;
- signed JWT;
- generic authentication failure messages;
- login rate limiting;
- no password/hash returned through API;
- unauthenticated -> `401`;
- unauthorized role -> `403`.

Frontend:

- Login;
- user management for ADMIN;
- route guards;
- session persistence;
- token renewal.

---

# 4. Scope Boundary

## In scope

- authentication;
- authorization;
- refresh-token lifecycle;
- users;
- clients;
- bikes;
- work orders;
- work-order items;
- work-order state machine;
- state history/audit trail;
- order totals;
- filtering;
- pagination;
- basic user administration;
- professional UI/UX;
- API documentation;
- setup documentation;
- automated tests;
- Git traceability;
- architecture decisions;
- Docker-based local reproducibility if it stays simple.

## Explicitly out of scope

Do not implement unless explicitly approved:

- inventory;
- suppliers;
- invoicing;
- payments;
- appointments;
- notifications;
- SMS;
- email;
- WhatsApp;
- customer portal;
- multi-tenancy;
- analytics platform;
- advanced dashboards;
- accounting;
- AI features;
- event bus;
- WebSockets;
- microservices;
- Redis;
- Kafka;
- RabbitMQ;
- Kubernetes;
- GraphQL.

---

# 5. Repository Architecture

Use a simple monorepo:

```text
pavas-moto-workshop/
├── backend/
├── frontend/
├── docs/
├── postman/
├── docker-compose.yml
├── .editorconfig
├── .gitignore
├── README.md
└── AGENTS.md
```

---

# 6. Backend Architecture

Use a **modular layered monolith**.

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── routes/
│   ├── middlewares/
│   ├── validators/
│   ├── constants/
│   ├── errors/
│   ├── utils/
│   └── app.js
├── migrations/
├── seeders/
├── tests/
├── .env.example
├── package.json
└── server.js
```

## Responsibility rules

### Routes

Responsible for:

- URL mapping;
- attaching middleware;
- delegating to controllers.

Routes must not contain business logic.

### Controllers

Responsible for:

- request extraction;
- calling services;
- mapping successful service results to HTTP responses.

Controllers must remain thin.

Controllers must not:

- directly mutate Sequelize models;
- contain transition rules;
- calculate order totals;
- implement authorization rules beyond calling middleware/service boundaries.

### Services

Responsible for:

- business rules;
- transactions;
- workflow orchestration;
- domain authorization;
- consistency across multiple writes.

Examples:

- `AuthService`
- `ClientService`
- `BikeService`
- `WorkOrderService`
- `UserService`

### Repositories

Responsible for:

- persistence access;
- reusable queries;
- filters;
- pagination;
- include graphs;
- row locking where required.

Avoid unnecessary repository wrappers for trivial operations if they add no value. However, complex WorkOrder queries should be isolated from controllers/services.

### Models

Responsible for:

- schema representation;
- associations;
- persistence-level constraints;
- safe serialization.

Models are not the place for HTTP logic.

### Validators

Responsible for validating external inputs before service execution.

### Middlewares

Centralize:

- authentication;
- authorization;
- validation result mapping;
- rate limiting;
- not-found handling;
- error handling.

### Errors

Use explicit application errors.

Recommended categories:

```text
AppError
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
BusinessRuleError
```

All errors must flow through one centralized HTTP error middleware.

---

# 7. Frontend Architecture

```text
frontend/
├── src/
│   ├── api/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── context/
│   ├── constants/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── tests/
├── .env.example
└── package.json
```

Prefer feature grouping where practical.

Example:

```text
features/
├── auth/
├── users/
├── clients/
├── bikes/
└── workOrders/
```

Avoid introducing Redux unless state complexity proves it necessary.

Default state strategy:

- server state: API calls and local page state;
- auth state: dedicated `AuthContext` or equivalent narrowly scoped provider;
- form state: local component state unless a lightweight form library is later justified.

---

# 8. Domain Model

## Client

```text
id
name
phone
email nullable
created_at
updated_at
```

Relationships:

```text
Client 1 -> N Bike
```

---

## Bike

```text
id
plate UNIQUE
brand
model
cylinder nullable
client_id FK -> clients.id
created_at
updated_at
```

Relationships:

```text
Bike N -> 1 Client
Bike 1 -> N WorkOrder
```

Plate rules:

- store normalized plate values;
- define one normalization policy and test it;
- uniqueness must be enforced at database level and application level.

Recommended normalization:

```text
trim
uppercase
remove unnecessary spaces
```

Do not invent Colombian plate-format validation unless explicitly approved; the source assessment requires uniqueness, not a specific national plate regex.

---

## WorkOrder

```text
id
bike_id FK -> bikes.id
entry_date
fault_description
status
total
created_at
updated_at
```

Relationships:

```text
WorkOrder N -> 1 Bike
WorkOrder 1 -> N WorkOrderItem
WorkOrder 1 -> N WorkOrderStatusHistory
```

`total` is controlled by the backend.

The frontend must never be authoritative for the final persisted total.

---

## WorkOrderItem

```text
id
work_order_id FK -> work_orders.id
type ENUM(MANO_OBRA, REPUESTO)
description
count
unit_value
created_at
updated_at
```

Rules:

```text
count > 0
unit_value >= 0
```

---

## User

```text
id
name
email UNIQUE
password_hash
role ENUM(ADMIN, MECANICO)
active
created_at
updated_at
```

Rules:

- email normalized;
- password never returned;
- inactive user cannot authenticate;
- only ADMIN manages users;
- initial ADMIN created with seed.

---

## WorkOrderStatusHistory

```text
id
work_order_id FK
from_status nullable
to_status
note nullable
changed_by_user_id FK -> users.id
created_at
```

Index:

```text
(work_order_id, created_at DESC, id DESC)
```

The source assessment explicitly requests `(work_order_id, created_at DESC)`. `id DESC` is added as a deterministic tie-breaker when multiple events share the same timestamp.

Queries must return newest first using:

```text
created_at DESC, id DESC
```

History rows are immutable audit records.

Initial work-order creation MUST create an initial audit event:

```text
NULL -> RECIBIDA
```

The initial history event:

- is created in the same transaction as the work order;
- stores the authenticated creator in `changed_by_user_id`;
- uses `from_status = NULL`;
- uses `to_status = RECIBIDA`;
- may use a null note or a clearly documented system note;
- is covered by tests and requirements traceability.

Do not provide update/delete endpoints for status history.

---

## RefreshToken

```text
id
user_id FK
family_id
token_hash
expires_at
revoked_at nullable
replaced_by_token_id nullable
created_at
```

Rules:

- raw refresh tokens must never be persisted;
- store only a cryptographic hash or deterministic secure token digest suitable for lookup;
- revoked tokens must not refresh sessions;
- expired tokens must not refresh sessions;
- token rotation is required;
- logout revokes the active refresh token;
- every login creates a refresh-token family/session;
- rotated tokens remain in the same family;
- reuse of a previously rotated/revoked token is treated as possible token theft/replay;
- on detected reuse, revoke all still-active refresh tokens in the affected family/session and return `401`.

---

# 9. Entity Relationship Overview

```text
Client
  │
  │ 1:N
  ▼
Bike
  │
  │ 1:N
  ▼
WorkOrder
  ├─────────────── 1:N ───────────────► WorkOrderItem
  │
  └─────────────── 1:N ───────────────► WorkOrderStatusHistory
                                           ▲
                                           │ N:1
                                           │
                                          User
                                           │
                                           │ 1:N
                                           ▼
                                      RefreshToken
```

---

# 10. Work-Order State Machine

Canonical states:

```text
RECIBIDA
DIAGNOSTICO
EN_PROCESO
LISTA
ENTREGADA
CANCELADA
```

Canonical transition map:

```javascript
{
  RECIBIDA: ["DIAGNOSTICO", "CANCELADA"],
  DIAGNOSTICO: ["EN_PROCESO", "CANCELADA"],
  EN_PROCESO: ["LISTA", "CANCELADA"],
  LISTA: ["ENTREGADA", "CANCELADA"],
  ENTREGADA: [],
  CANCELADA: []
}
```

Idempotent transition:

```text
currentStatus === requestedStatus
```

must return a clear business error and MUST NOT create audit history.

Do not enable rollback from `ENTREGADA` in the initial implementation.

The assessment lists ADMIN rollback as optional; it is deliberately excluded to preserve a simpler, defensible workflow unless explicitly approved later.

---

# 11. Transaction Rules

A transaction is mandatory when multiple database changes must succeed or fail as one operation.

## Status transition

Must be atomic and concurrency-safe:

```text
BEGIN
  SELECT work_order FOR UPDATE
  validate current order
  validate transition
  validate role
  update work order
  insert history
COMMIT
```

Use Sequelize row locking or an equivalent `SELECT ... FOR UPDATE` strategy while the transaction is active.

On failure:

```text
ROLLBACK
```

A concurrency integration test is required for competing status updates.

## Add item

Required atomic and concurrency-safe behavior:

```text
BEGIN
  SELECT work_order FOR UPDATE
  create item
  recalculate order total
  update order total
COMMIT
```

## Delete item

Required atomic and concurrency-safe behavior:

```text
BEGIN
  SELECT work_order FOR UPDATE
  delete item
  recalculate order total
  update order total
COMMIT
```

Use row locking or an equivalent strategy to serialize concurrent total mutations.

At least one concurrency integration test must verify total consistency during competing item mutations.

Money arithmetic must avoid unsafe floating-point assumptions.

Use an appropriate SQL decimal type.

---

# 12. Authentication Architecture

## Access token

- JWT;
- short lifetime;
- recommended default: 15 minutes;
- contains only required claims;
- signed using environment secret;
- never store password data inside token.

Suggested claims:

```text
sub
role
iat
exp
```

## Refresh token

- longer lifetime;
- delivered through `HttpOnly` cookie;
- `Secure` in production;
- suitable `SameSite` policy;
- persisted only as a hash/digest;
- rotated on each successful refresh;
- revocable.

## Login

```text
credentials
 -> normalize email
 -> find active user
 -> bcrypt.compare
 -> issue access token
 -> issue refresh token
 -> persist token digest
 -> set HttpOnly cookie
 -> return access token + safe user
```

Authentication failures must use a generic message.

Do not reveal whether an email exists.

## Refresh

```text
cookie
 -> verify token structure/signature
 -> lookup stored digest
 -> detect reuse if token is already revoked/replaced
 -> if reuse detected: revoke active tokens in the same family and return 401
 -> validate not expired
 -> validate user active
 -> rotate token
 -> revoke prior token
 -> issue new access token
 -> issue new refresh token in same family
```

Refresh-token family behavior must be covered by automated tests.

## Logout

- revoke current refresh token;
- clear refresh cookie;
- return safe success response.

---

# 13. Authorization Policy

## ADMIN

Allowed:

- create users through `POST /api/auth/register`;
- list users through `GET /api/users`;
- change user role through `PATCH /api/users/:id/role`;
- activate/deactivate users through `PATCH /api/users/:id/active`;
- create/read clients;
- create/read bikes;
- create/read work orders;
- add/remove items;
- all valid work-order state transitions;
- view history.

## MECANICO

Allowed:

- read required business data;
- create work-order items;
- change work-order state to:
  - DIAGNOSTICO
  - EN_PROCESO
  - LISTA
- view history.

Denied:

- create/manage users;
- ENTREGADA;
- CANCELADA;
- deleting work-order items.

Authorization must be enforced on the backend even if the UI also hides actions.

UI restrictions are never a security boundary.

---

# 14. Order Total Rule

Canonical formula:

```text
total = SUM(item.count * item.unit_value)
```

Requirements:

- calculated server-side;
- recalculated after item creation;
- recalculated after item deletion;
- persisted consistently;
- never trusted from frontend input.

Test:

```text
item A: 2 * 50,000
item B: 1 * 30,000

expected total = 130,000
```

---

# 15. API Conventions

Base prefix:

```text
/api
```

JSON only.

Recommended success envelope for single resources:

```json
{
  "data": {}
}
```

Recommended list envelope:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

The same pagination envelope applies to work-order history.

History pagination rules:

```text
page >= 1
pageSize default = 20
pageSize max = 100
ORDER BY created_at DESC, id DESC
```

Recommended error shape:

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition work order from ENTREGADA to EN_PROCESO."
  }
}
```

Validation errors may include a safe `details` array.

Do not expose:

- stack traces;
- SQL errors;
- JWT internals;
- hashes;
- environment values.

---

# 16. HTTP Status Convention

Use consistently:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity (only if consistently justified; otherwise prefer 400)
429 Too Many Requests
500 Internal Server Error
```

Recommended concrete mapping:

- invalid transition -> 400;
- invalid credentials -> 401;
- missing/invalid access token -> 401;
- wrong role -> 403;
- missing resource -> 404;
- duplicate plate/email -> 409;
- login rate limit -> 429.

---

# 17. Security Baseline

Mandatory:

- bcrypt cost >= 10;
- short-lived access token;
- refresh-token rotation;
- refresh-token revocation;
- HttpOnly refresh cookie;
- environment secrets;
- Helmet;
- restricted CORS configuration;
- login rate limiting;
- request body size limit;
- generic login errors;
- backend authorization;
- validation on all write endpoints;
- no password hashes serialized;
- no secrets committed;
- `.env.example` only;
- secure production cookie configuration;
- dependency audit before final submission.

Avoid custom cryptography.

Use maintained libraries.

---

# 18. UI / UX Principles

The UI must look like a real internal operations tool.

Goals:

- clear hierarchy;
- predictable navigation;
- responsive layout;
- low cognitive load;
- obvious status;
- visible feedback;
- role-aware actions;
- accessible controls;
- consistent spacing and components.

Required views:

```text
/login
/orders
/orders/new
/orders/:id
/admin/users
```

## Work-order list

Must include:

- plate;
- client;
- state;
- entry date;
- total;
- status filter;
- plate filter;
- pagination;
- loading state;
- empty state;
- error state.

## Create order

Must support:

- bike lookup by plate;
- selecting existing bike;
- quick client creation;
- quick bike creation;
- work-order creation;
- validation feedback.

## Work-order detail

Must include:

- client;
- bike;
- fault description;
- current state;
- allowed transition actions;
- item list;
- item creation;
- ADMIN item deletion;
- total;
- history timeline.

## History timeline

Each record should clearly display:

```text
date/time
user
from -> to
note
```

## User administration

ADMIN only:

- list users;
- create user;
- change role;
- activate/deactivate.

## UX rules

- disable actions during submission;
- show progress/loading;
- prevent accidental duplicate submissions;
- show clear success/error feedback;
- use confirmation before destructive actions;
- distinguish disabled-by-permission actions from loading states where useful;
- never expose backend error internals.

---

# 19. Git Strategy

Use `main` as stable integration branch.

Short-lived feature branches are allowed but not required.

Suggested branch names:

```text
feat/phase-1-domain
feat/phase-1-orders
feat/phase-1-ui
feat/auth
feat/audit
feat/security
docs/submission
```

## Conventional Commits

Allowed prefixes:

```text
feat:
fix:
test:
docs:
refactor:
chore:
security:
```

Examples:

```text
chore: initialize project structure
docs: document modular monolith architecture
feat(db): implement phase 1 domain schema
feat(clients): implement client endpoints
feat(bikes): implement bike endpoints
feat(work-orders): implement validated state transitions
test(work-orders): cover valid and invalid transitions
feat(auth): implement refresh token rotation
security: harden authentication endpoints
docs: finalize technical submission
```

Forbidden commit messages:

```text
fix
changes
final
final2
stuff
wip
update
misc
```

Each commit must:

- compile/run;
- avoid unrelated changes;
- represent one coherent unit of work.

---

# 20. Git Tags

When acceptance passes:

```text
v1.0-phase-1
v2.0-phase-2
v2.1-submission
```

Do not create tags before milestone verification.

---

# 21. Architectural Decision Records

Directory:

```text
docs/decisions/
```

Required ADRs:

```text
ADR-001-modular-monolith.md
ADR-002-refresh-token-rotation.md
ADR-003-work-order-state-machine.md
ADR-004-server-side-order-total.md
```

Each ADR format:

```text
# ADR-XXX: Title

## Status
Accepted

## Context

## Decision

## Alternatives Considered

## Consequences
```

Do not create ADRs for trivial implementation details.

---

# 22. Documentation Contract

Final documentation structure:

```text
docs/
├── architecture.md
├── database.md
├── api.md
├── security.md
├── business-rules.md
├── testing.md
├── requirements-traceability.md
└── decisions/
    ├── ADR-001-modular-monolith.md
    ├── ADR-002-refresh-token-rotation.md
    ├── ADR-003-work-order-state-machine.md
    └── ADR-004-server-side-order-total.md
```

README must include:

```text
Overview
Features
Architecture
Technology Stack
Requirements
Quick Start
Environment Variables
Database Setup
Seed / Demo Accounts
Execution
API Summary
Authentication
Role Permissions
Business Rules
Testing
Security Notes
Project Structure
Architectural Decisions
Postman
Assumptions
Known Limitations
```

---

# 23. Requirements Traceability

Create:

```text
docs/requirements-traceability.md
```

Each requirement must map to:

```text
Requirement
Source Phase
Implementation
Endpoint/UI
Automated Test
Status
```

Example:

| Requirement | Phase | Implementation | Test | Status |
|---|---|---|---|---|
| Unique plate | 1 | Bike validation + DB unique constraint | bike integration test | Done |
| Invalid transition -> 400 | 1 | WorkOrderService state machine | work-order transition test | Done |
| JWT auth | 2 | Auth middleware | auth integration test | Done |
| 403 wrong role | 2 | authorize middleware | RBAC test | Done |
| Status history | 2 | status history transaction | history integration test | Done |

The traceability document must remain current after every milestone.

---

# 24. Testing Strategy

Testing must prioritize business risk.

Recommended backend tools:

- Jest
- Supertest

Frontend:

- Vitest
- React Testing Library

Do not chase coverage percentage for vanity.

Critical automated tests:

## Authentication

- login success;
- invalid credentials -> 401;
- inactive user rejected;
- password hash never returned;
- refresh success;
- refresh token rotation;
- revoked refresh rejected;
- logout revokes refresh;
- expired/invalid refresh rejected.

## Authorization

- unauthenticated endpoint -> 401;
- MECANICO cannot administer users -> 403;
- MECANICO cannot mark ENTREGADA;
- MECANICO cannot CANCELADA;
- ADMIN can perform allowed administrative actions.

## Bikes

- unique plate;
- normalized duplicate rejected.

## Work orders

- invalid bike rejected;
- valid creation succeeds;
- filters work;
- pagination works.

## Items

- count <= 0 rejected;
- unit value < 0 rejected;
- item creation recalculates total;
- item deletion recalculates total;
- MECANICO cannot delete item.

## State machine

Test every valid path.

Test invalid examples:

```text
RECIBIDA -> LISTA
DIAGNOSTICO -> ENTREGADA
ENTREGADA -> CANCELADA
CANCELADA -> EN_PROCESO
same-state transition
```

## Audit

- valid transition creates exactly one row;
- audit has actor;
- audit has timestamp;
- audit stores from/to;
- note persisted;
- invalid transition creates no row;
- same-state transition creates no row;
- newest-first ordering.

---

# 25. Integration Test Database Strategy

Integration tests MUST use a dedicated MySQL database isolated from development and production data.

Required convention:

```text
development database: pavas_workshop
test database:        pavas_workshop_test
```

Names may be configurable through environment variables, but environments must remain distinct.

## Mandatory safeguards

- `NODE_ENV=test` for integration suites;
- test DB configuration is separate from development;
- the test runner must refuse to run destructive integration setup against a production environment;
- tests must never use production credentials;
- migrations run against the test DB before integration tests;
- test data must be deterministic;
- demo/development seeds must not implicitly pollute test suites;
- database state must be cleaned or isolated between tests;
- test order must not affect test results.

## Recommended lifecycle

```text
beforeAll
  connect to dedicated test database
  apply migrations

beforeEach / test helper
  reset relevant data deterministically

tests

afterAll
  close Sequelize connections
```

Factories/helpers may be used to create deterministic fixtures.

The exact cleanup technique may be truncate/reset or transaction-based isolation if compatible with the tested behavior. Concurrency tests may require committed rows and therefore must not depend on a single enclosing rollback transaction.

Document the final strategy in:

```text
docs/testing.md
```

before the test suite is considered complete.

---

# 26. Environment Variables

Backend `.env.example` should document only names and safe examples.

Suggested variables:

```text
NODE_ENV=
PORT=

DB_HOST=
DB_PORT=
DB_NAME=
DB_NAME_TEST=
DB_USER=
DB_PASSWORD=

JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=

JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=

BCRYPT_ROUNDS=

FRONTEND_ORIGIN=

COOKIE_SECURE=
COOKIE_SAME_SITE=
```

Frontend:

```text
VITE_API_BASE_URL=
```

Never commit real secrets.

---

# 27. Dependency Rules

Before adding a dependency, answer:

1. What requirement does it solve?
2. Can the standard library/current stack solve it cleanly?
3. Is the package maintained?
4. Does the value justify complexity?

Preferred additional dependencies are limited to practical needs such as:

Backend:

- bcrypt
- jsonwebtoken
- helmet
- cors
- express-rate-limit
- dotenv
- validation library if selected
- test libraries

Frontend:

- axios
- react-router-dom
- minimal UI/icon dependencies if clearly justified

Avoid large frameworks merely for visual polish.

---

# 28. Milestone Execution Rules

For every milestone Codex must follow this process:

## Before implementation

Output:

```text
Milestone
Goal
Requirements covered
Files expected to change
Risks
Verification plan
```

Do not start unrelated future milestones.

## During implementation

- keep scope limited;
- update tests;
- update docs if behavior changes;
- preserve backward compatibility unless the milestone intentionally changes behavior.

## After implementation

Codex must run and report:

```text
lint/status
tests
migration status if applicable
manual verification steps
remaining known issues
```

Then output a milestone acceptance checklist.

Do not claim completion if any mandatory acceptance item fails.

---

# 29. Milestones

---

## HITO 0 — Repository Foundation and Architecture

### Goal

Create the project skeleton and freeze the initial engineering conventions before business implementation.

### Work

Initialize Git if `.git/` does not exist:

```text
git init
```

Do not create commits automatically.

Create:

```text
backend/
frontend/
docs/
postman/
README.md
AGENTS.md
.editorconfig
.gitignore
docker-compose.yml if justified
```

Define:

- backend layering;
- frontend organization;
- ER model;
- API conventions;
- error format;
- security principles;
- Git conventions;
- ADR template;
- dedicated integration-test database strategy;
- history pagination/performance contract;
- initial `NULL -> RECIBIDA` audit decision.

Create:

```text
docs/architecture.md
docs/database.md
docs/business-rules.md
docs/requirements-traceability.md
docs/decisions/ADR-001-modular-monolith.md
```

### Acceptance

- [ ] Git repository initialized;
- [ ] repository structure exists;
- [ ] backend boots;
- [ ] frontend boots;
- [ ] no business feature is prematurely implemented;
- [ ] architecture is documented;
- [ ] ER model is documented;
- [ ] state machine is documented;
- [ ] Git conventions are documented;
- [ ] requirement traceability skeleton exists;
- [ ] `.env.example` exists where applicable;
- [ ] secrets are absent;
- [ ] backend health test exists and passes;
- [ ] frontend smoke test renders `App` and passes;
- [ ] dedicated test database strategy is documented;
- [ ] history pagination/performance requirement is represented in traceability;
- [ ] initial `NULL -> RECIBIDA` audit rule is documented;
- [ ] initial tests/tooling can execute.

### Suggested commits

```text
chore: initialize full stack project structure
docs: define architecture domain model and repository conventions
```

Do not proceed to HITO 1 until acceptance passes.

---

## HITO 1 — Phase 1 Database Domain

### Goal

Implement the Phase 1 persistence model.

### Entities

- Client
- Bike
- WorkOrder
- WorkOrderItem

### Work

- Sequelize configuration;
- environment-aware DB configuration;
- dedicated test DB configuration;
- models;
- associations;
- migrations;
- constraints;
- indexes;
- decimal money types;
- DB naming conventions;
- migration/bootstrap helpers for integration tests.

### Acceptance

- [ ] all four entities migrate successfully;
- [ ] FK relationships are enforced;
- [ ] plate uniqueness enforced at DB level;
- [ ] item count constraint validated;
- [ ] item unit value constraint validated;
- [ ] migrations work from clean DB;
- [ ] migrations can be reverted where practical;
- [ ] integration tests target the dedicated test DB;
- [ ] destructive test setup cannot target production;
- [ ] test DB migration path verified;
- [ ] database docs updated;
- [ ] traceability updated.

### Commit

```text
feat(db): implement phase 1 domain model and migrations
```

---

## HITO 2 — Clients and Bikes API

### Goal

Implement Phase 1 client/bike endpoints.

### Endpoints

```text
POST /api/clients
GET  /api/clients?search=
GET  /api/clients/:id

POST /api/bikes
GET  /api/bikes?plate=
GET  /api/bikes/:id
```

### Acceptance

- [ ] client create works;
- [ ] client search works;
- [ ] client detail works;
- [ ] bike create works;
- [ ] bike plate search works;
- [ ] bike detail works;
- [ ] plate normalization documented;
- [ ] duplicate plate -> 409 or documented consistent error;
- [ ] invalid client relation rejected;
- [ ] validation errors are clear;
- [ ] integration tests pass;
- [ ] traceability updated.

### Commits

```text
feat(clients): implement client management endpoints
feat(bikes): implement bike management and plate validation
test(clients-bikes): cover client and bike API rules
```

---

## HITO 3 — Work Orders API

### Goal

Implement work-order creation, detail, listing, filtering, and pagination.

### Endpoints

```text
POST /api/work-orders
GET  /api/work-orders?status=&plate=&page=&pageSize=
GET  /api/work-orders/:id
```

### Acceptance

- [ ] invalid bike rejected;
- [ ] valid order starts in RECIBIDA;
- [ ] entry date handled consistently;
- [ ] list includes plate and client data;
- [ ] filter by status works;
- [ ] filter by plate works;
- [ ] pagination metadata correct;
- [ ] detail returns client + bike + items;
- [ ] integration tests pass;
- [ ] docs updated;
- [ ] traceability updated.

### Commit

```text
feat(work-orders): implement work order creation listing and filtering
```

---

## HITO 4 — Work-Order Items and Totals

### Goal

Implement item management and authoritative total calculation.

### Endpoints

```text
POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
```

### Acceptance

- [ ] count > 0;
- [ ] unit value >= 0;
- [ ] valid item creates successfully;
- [ ] invalid order rejected;
- [ ] total recalculated after create;
- [ ] total recalculated after delete;
- [ ] total operations use transaction;
- [ ] WorkOrder row is locked or equivalent concurrency control is used during item/total mutation;
- [ ] decimal arithmetic is safe;
- [ ] tests verify totals;
- [ ] concurrency test verifies total consistency;
- [ ] docs updated;
- [ ] traceability updated.

### Commits

```text
feat(work-orders): implement transactional work order items and totals
test(work-orders): cover item validation and total consistency
```

---

## HITO 5 — Phase 1 State Machine

### Goal

Implement canonical work-order transition rules.

### Endpoint

```text
PATCH /api/work-orders/:id/status
```

Phase 1 body may be normalized now to the Phase 2 contract:

```json
{
  "toStatus": "DIAGNOSTICO",
  "note": null
}
```

The `note` field may be ignored until history is added, but the API shape should not need to break later.

### Acceptance

- [ ] every valid transition passes;
- [ ] CANCELADA follows required rule;
- [ ] ENTREGADA is terminal;
- [ ] CANCELADA is terminal;
- [ ] invalid transition -> 400;
- [ ] same-state transition rejected;
- [ ] transition rules centralized;
- [ ] WorkOrder row is locked or equivalent concurrency control is used during transition;
- [ ] tests cover all transition paths;
- [ ] concurrency test covers competing transition attempts;
- [ ] business-rules docs updated;
- [ ] traceability updated.

### Commits

```text
feat(work-orders): implement validated work order state machine
test(work-orders): cover valid invalid and idempotent transitions
```

### Phase 1 backend gate

At this point, all mandatory Phase 1 backend requirements must pass.

---

## HITO 6 — Phase 1 Frontend

### Goal

Complete all Phase 1 UI requirements.

### Views

```text
/orders
/orders/new
/orders/:id
```

### Acceptance

- [ ] order table;
- [ ] plate column;
- [ ] client column;
- [ ] status column;
- [ ] date column;
- [ ] total column;
- [ ] status filter;
- [ ] plate filter;
- [ ] pagination;
- [ ] create order flow;
- [ ] existing bike lookup;
- [ ] quick client registration;
- [ ] quick bike registration;
- [ ] order detail;
- [ ] valid status actions only;
- [ ] item creation;
- [ ] item deletion for current pre-auth phase;
- [ ] total display;
- [ ] loading states;
- [ ] error states;
- [ ] empty states;
- [ ] responsive baseline;
- [ ] frontend tests for critical interactions where practical.

### Suggested commits

```text
feat(ui): implement phase 1 application shell and routing
feat(ui): implement work order listing filters and pagination
feat(ui): implement work order creation workflow
feat(ui): implement work order detail and item management
```

### Phase 1 completion gate

Run:

- backend tests;
- frontend tests;
- lint;
- clean database migration;
- manual end-to-end smoke test.

Only then create:

```text
v1.0-phase-1
```

---

## HITO 7 — Authentication and Refresh Tokens

### Goal

Implement Phase 2 authentication with production-minded refresh-token lifecycle.

### Entities

- User
- RefreshToken

### Endpoints

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

ADMIN creation seed also required.

### Acceptance

- [ ] initial ADMIN seed;
- [ ] bcrypt cost >= 10;
- [ ] generic login errors;
- [ ] short-lived access token;
- [ ] HttpOnly refresh cookie;
- [ ] token digest stored, not raw token;
- [ ] refresh rotation;
- [ ] token family/session identifier implemented;
- [ ] old token revoked after rotation;
- [ ] rotated token stays in the same family;
- [ ] reuse of a previously rotated token is detected;
- [ ] reuse detection revokes all active tokens in the affected family;
- [ ] logout revokes active token;
- [ ] inactive user rejected;
- [ ] `/me` returns safe user;
- [ ] passwords/hashes never serialized;
- [ ] auth tests cover invalid credentials, inactive user, refresh expiration, rotation, revocation, reuse detection and logout;
- [ ] auth tests pass;
- [ ] security docs updated;
- [ ] ADR-002 created;
- [ ] traceability updated.

### Commits

```text
feat(auth): implement JWT authentication and refresh token rotation
test(auth): cover login refresh logout and token revocation
```

---

## HITO 8 — Role-Based Access Control

### Goal

Implement ADMIN/MECANICO backend authorization.

### Endpoints

Add:

```text
POST  /api/auth/register
GET   /api/users
PATCH /api/users/:id/role
PATCH /api/users/:id/active
```

All are ADMIN-only.

### Acceptance

- [ ] all business endpoints require auth;
- [ ] no token -> 401;
- [ ] wrong role -> 403;
- [ ] ADMIN user registration works;
- [ ] ADMIN user listing works;
- [ ] ADMIN role update works;
- [ ] ADMIN activate/deactivate works;
- [ ] all user responses exclude `password_hash`;
- [ ] MECANICO cannot manage users;
- [ ] MECANICO allowed transitions only;
- [ ] MECANICO cannot ENTREGADA;
- [ ] MECANICO cannot CANCELADA;
- [ ] MECANICO cannot delete items;
- [ ] frontend cannot be used to bypass backend;
- [ ] RBAC integration tests pass;
- [ ] docs updated;
- [ ] traceability updated.

### Commits

```text
feat(auth): implement role based access control
test(auth): cover role authorization boundaries
```

---

## HITO 9 — Work-Order Status Audit History

### Goal

Implement Phase 2 audit history atomically with state transitions.

### Entity

`WorkOrderStatusHistory`

### Endpoint

```text
GET /api/work-orders/:id/history?page=&pageSize=
```

History rules:

```text
default page = 1
default pageSize = 20
maximum pageSize = 100
ORDER BY created_at DESC, id DESC
index = (work_order_id, created_at DESC, id DESC)
```

### Status update

```text
PATCH /api/work-orders/:id/status
```

Body:

```json
{
  "toStatus": "LISTA",
  "note": "Road test completed"
}
```

### Acceptance

- [ ] creating a work order creates `NULL -> RECIBIDA` history in the same transaction;
- [ ] initial audit stores the authenticated creator;
- [ ] valid transition updates order;
- [ ] valid transition creates exactly one audit row;
- [ ] audit stores actor;
- [ ] audit stores from;
- [ ] audit stores to;
- [ ] audit stores optional note;
- [ ] audit stores time;
- [ ] invalid transition creates no audit row;
- [ ] same-state request creates no audit row;
- [ ] update + history insertion are one transaction;
- [ ] history newest first using `created_at DESC, id DESC`;
- [ ] history pagination metadata correct;
- [ ] pageSize is capped at 100;
- [ ] expected index `(work_order_id, created_at DESC, id DESC)` exists;
- [ ] test with more than 100 history rows verifies pagination and stable ordering;
- [ ] history endpoint tested;
- [ ] implementation and query plan are reviewed against the `<1s` assessment target under realistic local test data;
- [ ] ADR-003 updated/created;
- [ ] docs updated;
- [ ] traceability updated.

### Commits

```text
feat(audit): implement transactional work order status history
test(audit): cover status history consistency and ordering
```

---

## HITO 10 — Phase 2 Frontend

### Goal

Implement authenticated UX, role guards, user management, and audit timeline.

### Views

```text
/login
/admin/users
/orders
/orders/new
/orders/:id
```

### Acceptance

- [ ] login;
- [ ] session restore;
- [ ] transparent refresh flow;
- [ ] logout;
- [ ] protected routes;
- [ ] role-protected routes;
- [ ] ADMIN user list;
- [ ] ADMIN create user;
- [ ] ADMIN role update;
- [ ] ADMIN activate/deactivate user;
- [ ] MECANICO UI permissions;
- [ ] status history timeline;
- [ ] API 401 recovery behavior;
- [ ] loaders;
- [ ] clear auth errors;
- [ ] responsive baseline;
- [ ] frontend tests for auth guards where practical.

### Commits

```text
feat(ui-auth): implement authenticated session and protected routes
feat(ui-admin): implement user administration
feat(ui-audit): implement work order history timeline
```

---

## HITO 11 — Security Hardening

### Goal

Apply the final security baseline.

### Work

- Helmet;
- restricted CORS;
- body limits;
- login rate limiting;
- production cookie policy;
- secret validation;
- safer HTTP headers;
- sanitized error responses;
- dependency audit;
- auth edge-case review.

### Acceptance

- [ ] Helmet active;
- [ ] CORS origin explicit;
- [ ] request size limited;
- [ ] login rate limiter verified;
- [ ] secrets fail-fast when missing;
- [ ] no stack traces in production responses;
- [ ] no sensitive fields serialized;
- [ ] production cookie options documented;
- [ ] dependency audit reviewed;
- [ ] security tests pass;
- [ ] `docs/security.md` complete;
- [ ] traceability updated.

### Commit

```text
security: harden authentication API and HTTP configuration
```

---

## HITO 12 — Critical Test Suite

### Goal

Close business-risk gaps with automated integration tests.

### Acceptance

The milestone is not complete until the full critical matrix from the repository testing strategy is represented by concrete automated tests.

Authentication:

- [ ] login success;
- [ ] invalid credentials -> 401;
- [ ] inactive user rejected;
- [ ] password hash never returned;
- [ ] refresh success;
- [ ] refresh expiration/invalid token rejected;
- [ ] refresh rotation;
- [ ] previous token revoked after rotation;
- [ ] reuse of rotated token detected;
- [ ] reuse detection revokes active token family;
- [ ] logout revokes refresh token.

Authorization:

- [ ] unauthenticated business endpoint -> 401;
- [ ] wrong role -> 403;
- [ ] MECANICO cannot administer users;
- [ ] MECANICO cannot ENTREGADA;
- [ ] MECANICO cannot CANCELADA;
- [ ] MECANICO cannot delete items.

Clients/Bikes:

- [ ] client create/search/detail;
- [ ] unique plate;
- [ ] normalized duplicate plate rejected.

Work orders:

- [ ] invalid bike rejected;
- [ ] valid creation succeeds;
- [ ] creation generates `NULL -> RECIBIDA`;
- [ ] status filter;
- [ ] plate filter;
- [ ] pagination.

Items/totals:

- [ ] count <= 0 rejected;
- [ ] unit value < 0 rejected;
- [ ] item creation recalculates total;
- [ ] item deletion recalculates total;
- [ ] concurrent total mutation remains consistent.

State machine:

- [ ] every valid transition;
- [ ] representative invalid transitions;
- [ ] same-state/idempotent transition rejected;
- [ ] concurrent transition safety.

Audit:

- [ ] exactly one audit row per valid transition;
- [ ] actor stored;
- [ ] timestamp stored;
- [ ] from/to stored;
- [ ] note stored;
- [ ] invalid transition creates no history;
- [ ] same-state creates no history;
- [ ] newest-first deterministic ordering;
- [ ] pagination >100 events;
- [ ] pageSize cap enforced.

User administration:

- [ ] ADMIN list users;
- [ ] ADMIN create user;
- [ ] ADMIN change role;
- [ ] ADMIN activate/deactivate;
- [ ] user payloads never expose `password_hash`.

The final release gate must verify this matrix explicitly, not merely report that the existing test suite passes.

Create:

```text
docs/testing.md
```

### Commit

```text
test: complete integration coverage for critical business rules
```

---

## HITO 13 — UI/UX Polish

### Goal

Make the application feel complete without expanding scope.

### Acceptance

- [ ] coherent layout;
- [ ] responsive navigation;
- [ ] status badges;
- [ ] disabled states;
- [ ] loading states;
- [ ] empty states;
- [ ] destructive confirmations;
- [ ] keyboard/focus baseline;
- [ ] semantic form labels;
- [ ] readable errors;
- [ ] mobile/tablet smoke test;
- [ ] no new business modules.

### Commit

```text
refactor(ui): polish responsive states feedback and accessibility
```

---

## HITO 14 — Submission Documentation

### Goal

Make the repository independently understandable and reproducible.

### Deliverables

- README complete;
- architecture document;
- database document;
- API document;
- security document;
- business-rules document;
- testing document;
- requirements traceability;
- four ADRs;
- Postman collection;
- `.env.example`;
- optional architecture/ER diagrams;
- demo credentials instructions;
- known limitations.

### Acceptance

A reviewer unfamiliar with the code can:

1. understand the architecture;
2. understand the business rules;
3. install the project;
4. configure environment variables;
5. initialize the DB;
6. create/seed ADMIN;
7. run backend;
8. run frontend;
9. login;
10. execute the assessment flows;
11. run tests;
12. inspect API through Postman.

### Commits

```text
docs: complete architecture API security and testing documentation
docs: finalize technical assessment submission guide
```

---

## HITO 15 — Final Verification and Release

### Goal

Produce a clean, reproducible final submission.

### Required commands/checks

- clean install;
- clean DB migration;
- seed;
- backend start;
- frontend start;
- backend tests;
- frontend tests;
- lint;
- production build;
- dependency audit review;
- Postman smoke test;
- requirements traceability review;
- explicit review that every HITO 12 critical-matrix item has a concrete passing test;
- Git status clean.

### Manual E2E scenario

1. login ADMIN;
2. create MECANICO;
3. create client;
4. create bike;
5. create work order;
6. add REPUESTO;
7. add MANO_OBRA;
8. verify total;
9. move RECIBIDA -> DIAGNOSTICO;
10. inspect audit history;
11. login MECANICO;
12. move DIAGNOSTICO -> EN_PROCESO;
13. move EN_PROCESO -> LISTA;
14. verify MECANICO cannot ENTREGADA;
15. login ADMIN;
16. move LISTA -> ENTREGADA;
17. verify ENTREGADA cannot change;
18. verify audit trail;
19. verify unauthorized/forbidden cases.

### Final acceptance

- [ ] Phase 1 100% mandatory;
- [ ] Phase 2 100% mandatory;
- [ ] refresh token option complete;
- [ ] logout complete;
- [ ] Postman complete;
- [ ] tests passing;
- [ ] full critical test matrix explicitly verified;
- [ ] concurrency tests passing;
- [ ] history >100 pagination test passing;
- [ ] refresh-token reuse/family revocation test passing;
- [ ] user administration backend tests passing;
- [ ] build passing;
- [ ] docs complete;
- [ ] no secrets;
- [ ] no debug code;
- [ ] no TODO blocking requirement;
- [ ] Git history coherent;
- [ ] traceability table complete;
- [ ] clean working tree.

Create tags only after verification:

```text
v2.0-phase-2
v2.1-submission
```

---

# 30. Definition of Done

A feature is not done merely because its happy path works.

A feature is done only when:

- code exists;
- validation exists;
- errors are handled;
- authorization is enforced if applicable;
- automated tests exist for critical behavior;
- documentation is updated;
- traceability is updated;
- lint/tests pass;
- no unrelated scope was introduced.

---

# 31. Codex Reporting Format

At the end of every milestone, Codex must respond using this structure:

```text
## Milestone completed
HITO X — Name

## Implemented
- ...

## Architectural decisions
- ...

## Files changed
- ...

## Verification performed
- command
- result

## Acceptance checklist
- [x] ...
- [ ] ...

## Known issues
- none / list

## Requirement traceability updated
- yes/no

## Recommended commit
type(scope): message

## Next milestone
HITO X+1 — Name
```

If any mandatory checklist item remains unchecked, the milestone is NOT complete.

---

# 32. Codex Behavioral Guardrails

Codex MUST:

- inspect existing code before editing;
- preserve established naming/style;
- make the smallest coherent change;
- explain architectural changes;
- run relevant tests;
- distinguish assumptions from requirements;
- update docs when contracts change;
- keep commits independently meaningful;
- flag contradictions instead of silently choosing;
- favor explicit code over clever code for business-critical rules.

Codex MUST NOT:

- skip a milestone;
- pre-implement future milestones unless necessary for backward-compatible foundations;
- invent business requirements;
- add technologies for appearance;
- store secrets;
- store raw refresh tokens;
- return password hashes;
- trust frontend authorization;
- trust frontend totals;
- allow invalid state transitions;
- create audit history outside the status transaction;
- report tests passing if they were not run;
- silently ignore failed tests;
- rewrite large areas unrelated to the current milestone;
- create fake documentation for behavior that does not exist.

---

# 33. Naming Conventions

## JavaScript

- `camelCase`: variables/functions;
- `PascalCase`: classes/components/models;
- `UPPER_SNAKE_CASE`: constants;
- clear English names.

## Database

Use one consistent convention.

Preferred:

```text
snake_case
```

Examples:

```text
work_orders
work_order_items
work_order_status_history
refresh_tokens

client_id
bike_id
work_order_id
changed_by_user_id
created_at
updated_at
```

Map DB snake_case to JS camelCase through Sequelize configuration where useful.

## React

Components:

```text
WorkOrderList
WorkOrderDetail
StatusBadge
HistoryTimeline
```

Hooks:

```text
useAuth
useWorkOrders
```

Avoid abbreviations unless universally clear.

---

# 34. Code Quality Rules

- no giant controllers;
- no duplicated business rules;
- no magic status strings scattered across files;
- no raw SQL unless justified;
- no swallowed errors;
- no empty catch blocks;
- no sensitive logging;
- no business rules only in frontend;
- no unnecessary abstractions;
- no dead code;
- no commented-out implementation in final submission.

Centralize constants:

```text
WORK_ORDER_STATUS
USER_ROLE
WORK_ORDER_ITEM_TYPE
```

---

# 35. Logging Rules

Logging may include:

- request method/path;
- status;
- timing;
- application error code;
- safe resource IDs.

Never log:

- passwords;
- access tokens;
- refresh tokens;
- cookies;
- secrets;
- password hashes.

---

# 36. Performance Expectations

This is an MVP, so optimize obvious query behavior, not hypothetical scale.

Required:

- pagination for work-order list;
- indexed unique plate;
- history index;
- avoid obvious N+1 query patterns;
- history query designed to support >100 records;
- select only needed fields where practical.

Do not prematurely add caching.

---

# 37. Database Migration Policy

- schema changes only through migrations;
- migrations must be deterministic;
- seeds must be explicit and safe;
- initial ADMIN seed documented;
- do not rely on Sequelize `sync({ alter: true })` for final schema management;
- test clean migration path before release.

---

# 38. API Documentation Policy

Document:

- method;
- path;
- auth requirement;
- roles;
- request parameters;
- request body;
- response;
- common errors.

Postman collection must reflect the implemented API, not an aspirational API.

---

# 39. Assumption Policy

If a requirement is not specified:

1. do not silently invent a business rule;
2. choose the smallest reasonable technical assumption;
3. document the assumption;
4. make it easy to change.

Examples:

- Plate normalization may be defined technically.
- A country-specific plate regex must not be invented.
- ADMIN reversal after ENTREGADA remains disabled because it is optional.
- MECANICO item deletion remains disabled because Phase 2 explicitly permits that interpretation.

---

# 40. Final Engineering Standard

The completed repository must demonstrate:

- requirement comprehension;
- business-rule modeling;
- relational data modeling;
- REST design;
- backend layering;
- React application design;
- authentication;
- authorization;
- refresh-token security;
- transaction usage;
- auditability;
- validation;
- error handling;
- testing;
- Git discipline;
- architecture documentation;
- UI/UX judgment;
- controlled scope.

The project must look like the work of an engineer who can make deliberate tradeoffs and explain them.

---

# 41. First Instruction to Codex

When this repository is first opened, Codex must NOT begin implementing business features.

First:

1. Read this entire `AGENTS.md`.
2. Read the supplied Phase 1 and Phase 2 assessment documents if present in the repository.
3. Briefly cross-check this contract against the source assessment and report any NEW material contradiction before editing.
4. Inspect the repository.
5. Initialize Git with `git init` if `.git/` does not exist; do not commit.
6. Execute **HITO 0 only**.
7. Produce the HITO 0 pre-implementation report.
8. Initialize only the agreed foundation.
9. Create a mandatory backend health test and mandatory frontend `App` smoke test.
10. Document the architecture, ER model, business rules, test-database strategy, history pagination/performance contract, conventions, and requirements traceability.
11. Run foundation verification.
12. Produce the HITO 0 completion report.
13. Stop.
14. Wait for explicit instruction before HITO 1.

The human operator remains responsible for approving milestone transitions.

