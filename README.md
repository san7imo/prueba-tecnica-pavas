# PAVAS Moto Workshop

## Overview

PAVAS Moto Workshop is a production-minded MVP for managing motorcycle workshop work orders. The repository is being delivered incrementally under the milestone contract in `AGENTS.md`.

The repository includes the complete Phase 1 product plus Phase 2 sessions, RBAC/user administration, work-order status audit history, authenticated role-aware frontend, security hardening, the HITO 12 critical acceptance matrix and the HITO 13 UI/accessibility polish.

## Features

Implemented through HITO 13:

- executable Express API foundation with `GET /api/health`;
- executable React/Vite foundation;
- centralized technical 404 and error handling;
- environment-driven Sequelize connection factory;
- MySQL development service through Docker Compose;
- lint and smoke-test tooling;
- architecture, data model, business-rule and traceability documentation;
- deterministic Phase 1 migrations and Sequelize models for Client, Bike, WorkOrder and WorkOrderItem;
- Client create/search/detail API;
- Bike create/normalized-plate search/detail API with nested client data;
- application and database enforcement of unique normalized plates;
- WorkOrder creation with validated Bike, server-controlled `RECIBIDA`/`0.00` defaults and optional server entry time;
- paginated WorkOrder listing with status/normalized-plate filters and eager Bike/Client data;
- WorkOrder detail with Bike, Client, persisted total and existing items;
- WorkOrder item creation/deletion with validation, atomic recalculation and safe decimal strings;
- WorkOrder row locking plus tested add/add and add/delete concurrency consistency;
- server-authoritative `SUM(count * unitValue)` totals and rollback coverage;
- canonical WorkOrder state machine with terminal states, cancellation and stable HTTP 400 errors;
- transactional `FOR UPDATE` status changes with exhaustive matrix and concurrency tests;
- responsive application shell and React Router views for `/orders`, `/orders/new` and `/orders/:id`;
- server-filtered order list with pagination, status badges and complete loading/error/empty states;
- existing-bike lookup plus integrated quick Client/Bike registration;
- WorkOrder detail with item creation/deletion, confirmations, valid status actions and server-authoritative total refresh;
- exact decimal-string subtotal and COP presentation without floating-point monetary arithmetic;
- focused frontend behavior tests for the critical Phase 1 workflows;
- guarded MySQL integration tests for the persistence and HTTP layers;
- Postman folders for the complete Phase 1 Client, Bike and WorkOrder API.
- User and hashed RefreshToken persistence with reversible migrations;
- env-driven idempotent initial ADMIN seed;
- generic bcrypt login, `/auth/me` and DB-backed inactive-user enforcement;
- short-lived access JWTs and HttpOnly refresh cookies;
- transactional refresh rotation, replacement links, family replay detection and session-scoped logout;
- login-specific rate limiting plus MySQL replay/concurrency tests.
- authenticated Client, Bike and WorkOrder API boundaries;
- reusable ADMIN/MECANICO authorization middleware with stable 401/403 semantics;
- ADMIN registration, safe user listing and role/active administration;
- immediate access-token rejection after role or active changes;
- MECANICO item/status permissions enforced in backend with workflow/RBAC separation.
- immutable WorkOrderStatusHistory persistence with physical WorkOrder/User foreign keys;
- atomic initial `NULL -> RECIBIDA` audit events tied to the authenticated creator;
- atomic transition/audit writes with notes, cancellation evidence and rollback coverage;
- authenticated ADMIN/MECANICO history API with safe actor serialization;
- deterministic indexed history pagination (`createdAt DESC, id DESC`) tested with 150 tied events;
- competing same-target transitions proven to create exactly one audit row.
- `/login` with generic credential errors, bootstrap loading and authenticated-user redirect;
- memory-only access-token session state restored by the HttpOnly refresh cookie;
- centralized Bearer injection, one controlled retry and single-flight refresh coordination for concurrent 401 responses;
- protected business routes plus an ADMIN-only `/admin/users` guard;
- identity/role navigation and logout that always clears local state;
- ADMIN user list/create/role/active controls with deactivation and self-mutation confirmations;
- role-aware order detail actions that hide delete/deliver/cancel controls from MECANICO;
- optional transition notes and a paginated newest-first status-history timeline;
- focused frontend tests for session restoration, guards, five concurrent 401 responses, users, permissions and history states.
- global Helmet headers, exact-origin credentialed CORS and a 100 KiB JSON request limit;
- startup validation for environment, origin, JWT lifetimes/secrets and production cookie invariants;
- safe malformed/oversized JSON errors plus generic sanitization of unexpected failures;
- explicit JWT purpose/algorithm boundary, cookie-clearing and CORS integration regressions;
- documented dependency audit, CSRF/XSS/SQL-injection posture and residual production risks.
- requirement-to-risk-to-test acceptance matrix spanning backend, frontend, concurrency and security;
- explicit frontend regressions for failed refresh cleanup, memory-only tokens, MECANICO allowed actions and user administration states.
- polished responsive workshop shell with consistent required-field, contrast and focus treatment;
- keyboard-focusable table regions, contained mobile item scrolling and explicit ADMIN role-change confirmation;
- operational status-action labels, localized feedback and accessible transition-note length guidance.

## Assessment Scope

The final solution will cover the mandatory requirements of PAVAS assessment Phase 1 and Phase 2. Optional refresh/logout support and a Postman collection are intentionally included by the repository contract.

## Architecture

The application uses a modular layered monolith: routes, controllers, services, repositories, Sequelize models and MySQL on the backend; feature-oriented pages/components, narrow API modules and local workflow state on the frontend.

See [docs/architecture.md](docs/architecture.md).

## Technology Stack

- Node.js 20.19+, 22.13+ or 24+
- Express
- MySQL 8
- Sequelize
- React with Vite
- React Router
- Axios
- Vitest, Supertest and React Testing Library
- ESLint

## Repository Structure

```text
.
├── backend/      Express application, migrations and Phase 1 API modules
├── frontend/     React application
├── docs/         Architecture and engineering documentation
├── docker/       Local MySQL initialization files
├── postman/      Postman collection for implemented endpoints
├── AGENTS.md     Engineering execution contract
└── docker-compose.yml
```

## Requirements

- Node.js 20.19+, 22.13+ or 24+
- npm 10+
- Docker with either Compose v2 (`docker compose`) or Compose v1 (`docker-compose`)

## Quick Start

1. Copy the safe example environment files and replace local passwords:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start MySQL:

   ```bash
   docker-compose up -d mysql
   ```

3. Install and run the backend:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. In another terminal, install and run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The API health endpoint is `http://localhost:3000/api/health`; Vite defaults to `http://localhost:5173` and proxies `/api` to the local backend.

## Environment Variables

Root `.env` configures local MySQL. `backend/.env` configures the API, exact frontend origin, separate access/refresh secrets, bcrypt, cookie, login limiter and ADMIN seed. `frontend/.env` configures the API base URL. Only `.env.example` files belong in Git; production secrets must be random, distinct and at least 32 characters. Production requires an HTTPS `FRONTEND_ORIGIN` and `COOKIE_SECURE=true`.

See the comments in each example file. Test integration suites must use `DB_NAME_TEST`, never the development or production database.

## Database Setup

MySQL uses separate `pavas_workshop` and `pavas_workshop_test` databases. Seven deterministic migrations currently create the Phase 1 domain, identity/session tables and status history:

```bash
cd backend
npm run db:migrate
```

Sequelize `sync({ alter: true })` is not an accepted schema strategy.

## Seed / Demo Accounts

After migrations, define `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL` and a password of at least 12 characters, then run:

```bash
cd backend
npm run db:seed:admin
```

The command normalizes email, hashes the password and is idempotent for an existing ADMIN email. It never prints the password. No credential is committed.

## Execution

Backend scripts:

```bash
npm run dev
npm start
npm test
npm run lint
```

Frontend scripts:

```bash
npm run dev
npm run build
npm test
npm run lint
```

## Development

Use short, coherent changes and Conventional Commits with `feat`, `fix`, `test`, `docs`, `refactor`, `chore` or `security`. Do not advance milestones without passing the current acceptance checklist and receiving approval.

## API Summary

Implemented endpoints include health, protected Phase 1 resources/status/items, paginated work-order history, all contractual Auth endpoints and ADMIN-only user list/role/active APIs. Payloads, cookies, authorization and errors are documented in [docs/api.md](docs/api.md).

## Authentication

Login issues a 15-minute-by-default access JWT and a longer refresh JWT in an HttpOnly cookie. The frontend keeps the access token only in memory, restores sessions with `/auth/refresh`, coordinates concurrent refresh attempts and clears state on logout/session expiry. Refresh tokens are stored by the backend only as SHA-256 digests, rotate transactionally and use family-scoped replay detection. See [docs/security.md](docs/security.md) and ADR-002.

## Role Permissions

Enforced in the backend. Both roles can create/read current business resources and add items; only ADMIN can delete items, deliver/cancel orders, register or administer users. See [docs/business-rules.md](docs/business-rules.md).

## Business Rules

The canonical total, state machine, atomic audit ledger and role matrix are active in the backend. See [docs/business-rules.md](docs/business-rules.md).

## Testing

```bash
cd backend && DB_PORT=3306 npm test
cd frontend && npm test
```

Backend tests require the dedicated MySQL test database and verify Phase 1, sessions, RBAC, user administration, audit atomicity/order/pagination, security headers/CORS/parser boundaries, immediate token invalidation and concurrency. Frontend tests verify Phase 1 workflows plus session bootstrap/logout, route guards, single-flight refresh/retry, user administration, role-aware actions and the history timeline. See [docs/testing.md](docs/testing.md) and the [critical acceptance matrix](docs/test-acceptance-matrix.md).

## Security Notes

- Never commit `.env` files or real credentials.
- Do not log passwords, tokens, cookies, hashes or secrets.
- Authentication, backend authorization, login rate limiting, Helmet, exact-origin credentialed CORS and bounded JSON parsing are active.
- Raw refresh tokens exist only in HttpOnly cookies; password hashes and token digests never appear in API payloads.
- Access tokens are held only in JavaScript memory; neither token type is written to `localStorage` or `sessionStorage`.
- CSP is intentionally owned by the frontend host because the Express service is JSON-only; see the threat model and production recommendations in `docs/security.md`.

## Documentation

- [Architecture](docs/architecture.md)
- [Database model](docs/database.md)
- [API conventions](docs/api.md)
- [Business rules](docs/business-rules.md)
- [Testing strategy](docs/testing.md)
- [Critical test acceptance matrix](docs/test-acceptance-matrix.md)
- [Requirements traceability](docs/requirements-traceability.md)
- [Security](docs/security.md)
- [ADR-001](docs/decisions/ADR-001-modular-monolith.md)
- [ADR-002](docs/decisions/ADR-002-refresh-token-rotation.md)
- [ADR-003](docs/decisions/ADR-003-work-order-state-machine.md)
- [ADR-004](docs/decisions/ADR-004-server-side-order-total.md)

## Architectural Decisions

Accepted decisions are stored under `docs/decisions/`. ADR-002 records the implemented persisted refresh-token rotation and family replay response.

## Postman

Import [the Postman collection](postman/PAVAS-Moto-Workshop.postman_collection.json) for Auth, Users and protected business APIs. Login captures `accessToken`; Postman manages the HttpOnly cookie and sends Bearer authorization collection-wide. No real credentials are included. See [postman/README.md](postman/README.md).

## Assumptions

- MySQL 8 is the target database.
- Dates use the migration-defined MySQL `DATETIME(3)` representation and will be exposed in ISO 8601 form by their future APIs.
- Plate normalization is technical only; no Colombian plate regex will be invented.
- WorkOrder `entryDate` requires an ISO 8601 date-time with timezone when provided and otherwise uses current server time.
- The HITO 6 creation screen intentionally omits `entryDate`, so the backend server time is the single default.
- WorkOrder pages default to 1/20, reject page sizes above 100 and use `entryDate DESC, id DESC`.
- History pages default to 1/20, reject page sizes above 100 and use `createdAt DESC, id DESC`.
- Every API-created order records `NULL -> RECIBIDA` with the authenticated creator and a null system note.

## Known Limitations

Last-ADMIN protection is outside this MVP, so an ADMIN may change its own role or active flag. The UI confirms self-demotion and refreshes the session immediately; self-deactivation logs the user out. Local development works through the Vite proxy; a separately hosted frontend must exactly match `FRONTEND_ORIGIN`.

`npm audit` reports two moderate records for one Sequelize 6.37.8 → `uuid` 8.3.2 advisory chain. The application does not invoke the affected buffer-taking UUID APIs; Sequelize 6.37.8 is the newest v6 release, and npm proposes an unsafe downgrade to Sequelize 3. No forced fix was applied. This accepted residual risk must be rechecked before release.

## Current Milestone

**HITO 13 — UI/UX Polish implemented locally.** Awaiting milestone review; no HITO 14 work is included.

## Roadmap

The milestone sequence is defined in `AGENTS.md`: Phase 1 domain/API/UI first, followed by Phase 2 authentication, RBAC, audit, security, critical tests, polish and submission verification.
