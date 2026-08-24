# ADR-003: Work-Order State Machine

## Status

Accepted

## Context

Work orders follow a restricted operational workflow rather than unrestricted CRUD updates. Forward progress, cancellation, terminal states and idempotent requests must behave consistently across the API, future authorization and Phase 2 audit history.

## Decision

Use one explicit transition map in a domain utility independent of HTTP and Sequelize. `canTransition(fromStatus, toStatus)` accepts only edges present in that map. The WorkOrder service acquires a row lock inside a transaction, reads the persisted current state, validates the requested edge and updates the status before commit.

`ENTREGADA` and `CANCELADA` are terminal. Same-state requests use the same invalid-transition rule and return HTTP 400. Unknown target states are rejected at the API validation boundary before the workflow runs.

## Alternatives Considered

- Dispersed conditionals in routes, controllers or services: rejected because rules would drift and become difficult to audit.
- Numeric ordering of states: rejected because cancellation and terminal behavior are graph rules, not a simple ordinal comparison.
- An external state-machine library: rejected because six states and eight allowed edges do not justify another dependency or abstraction layer.

## Consequences

- The full workflow is easy to inspect and test exhaustively.
- Every new state or transition requires an explicit map and test change.
- Concurrent requests are revalidated against the state read after acquiring the row lock.
- Phase 2 history can reuse the same validation inside the existing transaction and append its audit insert without rebuilding the workflow.
