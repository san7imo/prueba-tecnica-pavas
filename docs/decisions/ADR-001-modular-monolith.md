# ADR-001: Modular Layered Monolith

## Status

Accepted

## Context

The assessment implements one motorcycle-workshop domain with a React client, an Express API and a MySQL database. It requires transactional operations across orders, totals and history, must be delivered incrementally and should remain understandable to a reviewer.

The architecture needs clear ownership of HTTP concerns, business rules and persistence without adding operational systems unrelated to the assessment.

## Decision

Use a modular layered monolith. The backend is one Express application divided into routes, controllers, services, repositories, models, validators, middleware and errors. MySQL is the single source of persistent truth through Sequelize and deterministic migrations.

The frontend is a separate React application organized by feature while remaining in the same repository.

## Alternatives Considered

- **Unlayered CRUD application:** faster initially, but encourages business rules in controllers and weakens testability and transaction ownership.
- **Microservices:** adds network boundaries, deployment units, distributed consistency and observability work without a domain or scale requirement.
- **Serverless functions:** fragments transaction and middleware boundaries and does not improve the required local assessment workflow.

## Consequences

Positive consequences:

- simple local and production execution;
- straightforward MySQL transactions;
- explicit separation of concerns;
- cohesive integration tests;
- fewer operational dependencies.

Tradeoffs:

- modules share one runtime and database;
- discipline is required to prevent cross-layer shortcuts;
- independent scaling/deployment is not available, which is acceptable for this scope.

