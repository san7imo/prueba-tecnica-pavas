# PAVAS Moto Workshop

## Overview

PAVAS Moto Workshop is a production-minded MVP for managing motorcycle workshop work orders. The repository is being delivered incrementally under the milestone contract in `AGENTS.md`.

The current repository contains foundation code only. Clients, bikes, work orders, authentication, authorization and audit history are not implemented yet.

## Features

Implemented in HITO 0:

- executable Express API foundation with `GET /api/health`;
- executable React/Vite foundation;
- centralized technical 404 and error handling;
- environment-driven Sequelize connection factory;
- MySQL development service through Docker Compose;
- lint and smoke-test tooling;
- architecture, data model, business-rule and traceability documentation.

Business features remain pending for later approved milestones.

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
├── backend/      Express application and future migrations
├── frontend/     React application
├── docs/         Architecture and engineering documentation
├── docker/       Local MySQL initialization files
├── postman/      Postman delivery placeholder
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

HITO 0 starts MySQL and creates separate `pavas_workshop` and `pavas_workshop_test` databases. Domain schema migrations begin in HITO 1; Sequelize `sync({ alter: true })` is not an accepted schema strategy.

## Seed / Demo Accounts

No users or demo accounts exist in HITO 0. The initial ADMIN seed belongs to HITO 7.

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

Only `GET /api/health` is implemented. Planned business endpoints are documented as future contracts in [docs/api.md](docs/api.md); they must not be treated as available yet.

## Authentication

Not implemented in HITO 0. Phase 2 will add short-lived access JWTs and rotating HttpOnly refresh-token cookies with family-based reuse detection.

## Role Permissions

Not enforced in HITO 0. The approved ADMIN/MECANICO policy is documented in [docs/business-rules.md](docs/business-rules.md).

## Business Rules

The canonical state machine, totals, roles and audit behavior are documented in [docs/business-rules.md](docs/business-rules.md). They are specifications only at this milestone.

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

The backend currently verifies the technical health endpoint. The frontend currently verifies that `App` renders. The isolated MySQL integration-test strategy is documented in [docs/testing.md](docs/testing.md).

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

## Architectural Decisions

Accepted decisions are stored under `docs/decisions/`. Only ADR-001 is created in HITO 0; later ADRs will be created with their implementation milestones.

## Postman

The collection will be created after the endpoints exist. See [postman/README.md](postman/README.md).

## Assumptions

- MySQL 8 is the target database.
- Dates will be persisted consistently and exposed in ISO 8601 form; the exact migration types are finalized in HITO 1.
- Plate normalization is technical only; no Colombian plate regex will be invented.
- The first audit record will be `NULL -> RECIBIDA` once audit history is introduced in Phase 2.

## Known Limitations

HITO 0 deliberately has no domain schema, business endpoints, authentication or operational screens.

`npm audit` currently reports a moderate advisory in Sequelize 6.37.8's transitive `uuid` 8.3.2 dependency. npm offers only an unsafe downgrade to Sequelize 3 as an automatic fix, so no forced fix was applied. It must be reviewed again during HITO 11 and final dependency audit.

## Current Milestone

**HITO 0 — Repository Foundation and Architecture completed.** The foundation verification passes. HITO 1 must not begin without explicit approval.

## Roadmap

The milestone sequence is defined in `AGENTS.md`: Phase 1 domain/API/UI first, followed by Phase 2 authentication, RBAC, audit, security, critical tests, polish and submission verification.
