# PAVAS Moto Workshop

## Overview

PAVAS Moto Workshop is a production-minded MVP for managing motorcycle workshop work orders. The repository is being delivered incrementally under the milestone contract in `AGENTS.md`.

The repository currently includes the complete Phase 1 backend through HITO 5: Client/Bike operations, WorkOrder creation/read/filtering, transactional item totals and concurrency-safe state transitions. Operational frontend screens, authentication, authorization and audit history remain assigned to later milestones.

## Features

Implemented through HITO 5:

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
- guarded MySQL integration tests for the persistence and HTTP layers;
- Postman folders for all Client, Bike and HITO 5 WorkOrder requests.

Phase 1 frontend and Phase 2 capabilities remain pending for later approved milestones.

## Assessment Scope

The final solution will cover the mandatory requirements of PAVAS assessment Phase 1 and Phase 2. Optional refresh/logout support and a Postman collection are intentionally included by the repository contract.

## Architecture

The application uses a modular layered monolith: routes, controllers, services, repositories, Sequelize models and MySQL on the backend; feature-oriented React code with a narrow authentication context on the frontend.

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

The API health endpoint is `http://localhost:3000/api/health`; Vite defaults to `http://localhost:5173`.

## Environment Variables

Root `.env` configures the local MySQL container. `backend/.env` configures the API and future authentication settings. `frontend/.env` configures the API base URL. Only `.env.example` files belong in Git.

See the comments in each example file. Test integration suites must use `DB_NAME_TEST`, never the development or production database.

## Database Setup

MySQL uses separate `pavas_workshop` and `pavas_workshop_test` databases. HITO 1 implements deterministic Phase 1 migrations:

```bash
cd backend
npm run db:migrate
```

Sequelize `sync({ alter: true })` is not an accepted schema strategy.

## Seed / Demo Accounts

No users or demo accounts exist yet. The initial ADMIN seed belongs to HITO 7.

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

Implemented endpoints are `GET /api/health`, create/list/detail routes for clients, bikes and work orders, transactional item creation/deletion and validated status updates. Work-order listing supports status/plate filters and pagination. Payloads, normalization and error contracts are documented in [docs/api.md](docs/api.md); Phase 2 endpoints remain explicitly planned.

## Authentication

Not implemented yet. Phase 2 will add short-lived access JWTs and rotating HttpOnly refresh-token cookies with family-based reuse detection.

## Role Permissions

Not enforced yet. The approved ADMIN/MECANICO policy is documented in [docs/business-rules.md](docs/business-rules.md).

## Business Rules

The canonical total and state-machine rules are active in the backend. Roles and audit behavior remain documented for their later Phase 2 milestones in [docs/business-rules.md](docs/business-rules.md).

## Testing

```bash
cd backend && DB_PORT=3306 npm test
cd frontend && npm test
```

Backend tests require the dedicated MySQL test database and verify the Phase 1 schema, Client/Bike behavior, WorkOrder reads/items/totals and HITO 5 state-machine transaction/concurrency behavior. The frontend verifies that `App` renders. The isolated strategy is documented in [docs/testing.md](docs/testing.md).

## Security Notes

- Never commit `.env` files or real credentials.
- Do not log passwords, tokens, cookies, hashes or secrets.
- Authentication, authorization, Helmet, restricted CORS and rate limiting are Phase 2 work and are not claimed as active yet.

## Documentation

- [Architecture](docs/architecture.md)
- [Database model](docs/database.md)
- [API conventions](docs/api.md)
- [Business rules](docs/business-rules.md)
- [Testing strategy](docs/testing.md)
- [Requirements traceability](docs/requirements-traceability.md)
- [ADR-001](docs/decisions/ADR-001-modular-monolith.md)
- [ADR-003](docs/decisions/ADR-003-work-order-state-machine.md)
- [ADR-004](docs/decisions/ADR-004-server-side-order-total.md)

## Architectural Decisions

Accepted decisions are stored under `docs/decisions/`. ADR-001 defines the modular monolith, ADR-003 records the implemented state machine and ADR-004 records the server-side total strategy. ADR-002 remains tied to refresh-token implementation.

## Postman

Import [the Postman collection](postman/PAVAS-Moto-Workshop.postman_collection.json) to exercise the Client, Bike and WorkOrder flows implemented through HITO 5, including item totals and status-transition examples. It deliberately excludes endpoints that do not exist. See [postman/README.md](postman/README.md).

## Assumptions

- MySQL 8 is the target database.
- Dates use the migration-defined MySQL `DATETIME(3)` representation and will be exposed in ISO 8601 form by their future APIs.
- Plate normalization is technical only; no Colombian plate regex will be invented.
- WorkOrder `entryDate` requires an ISO 8601 date-time with timezone when provided and otherwise uses current server time.
- WorkOrder pages default to 1/20, reject page sizes above 100 and use `entryDate DESC, id DESC`.
- The first audit record will be `NULL -> RECIBIDA` once audit history is introduced in Phase 2.

## Known Limitations

Domain frontend screens, authentication, authorization and audit history are intentionally absent until their approved milestones. Status notes are accepted but intentionally not persisted until audit history is implemented.

`npm audit` currently reports a moderate advisory in Sequelize 6.37.8's transitive `uuid` 8.3.2 dependency. npm offers only an unsafe downgrade to Sequelize 3 as an automatic fix, so no forced fix was applied. It must be reviewed again during HITO 11 and final dependency audit.

## Current Milestone

**HITO 5 — Phase 1 Work-Order State Machine completed locally.** It is ready for review and commit with the verification evidence reported for this milestone. HITO 6 has not started.

## Roadmap

The milestone sequence is defined in `AGENTS.md`: Phase 1 domain/API/UI first, followed by Phase 2 authentication, RBAC, audit, security, critical tests, polish and submission verification.
