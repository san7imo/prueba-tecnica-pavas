# ADR-004: Server-Side Work-Order Total

## Status

Accepted

## Context

A work-order total is derived from persisted item quantities and unit values. Accepting a client-provided total would allow stale or manipulated values, while JavaScript binary floating-point arithmetic can lose decimal precision. Concurrent item mutations can also overwrite one another unless the item rows and stored total are coordinated.

## Decision

The backend is the only authority for `WorkOrder.total`. It is persisted so list/detail reads expose one consistent value without repeating an aggregate across every returned order. Every item creation or deletion runs in a Sequelize transaction and locks the owning `work_orders` row with `SELECT ... FOR UPDATE` before mutation. The total is then recalculated from all persisted items using MySQL `DECIMAL` arithmetic:

```text
CAST(COALESCE(SUM(count * unit_value), 0) AS DECIMAL(15,2))
```

The exact decimal string is persisted without conversion to JavaScript `Number`. Request decimals are validated and normalized to the schema's two-decimal scale before persistence. The SQL expression is a deliberately bounded Sequelize literal because the ORM has no portable exact cast abstraction for this aggregate.

## Alternatives Considered

- Trust a frontend-calculated total: rejected because the frontend is not a security or consistency boundary.
- Calculate the total only when reading an order: rejected because list reads would need repeated aggregates and the contractual persisted `total` could drift from the displayed value.
- Increment/decrement the stored total: rejected because drift can accumulate and recovery from inconsistent historical values is harder.
- Calculate with JavaScript `Number`: rejected because binary floating point is unsafe for money.
- Add a decimal arithmetic package: unnecessary while MySQL can calculate the authoritative aggregate exactly with the existing stack.

## Consequences

- Item and total changes commit or roll back together.
- Concurrent mutations for one order are serialized by one row lock.
- Deleting the final item naturally persists `0.00`.
- Each mutation performs an aggregate query over that order's items; this is appropriate for the assessment-scale MVP and avoids extra infrastructure.
- Totals are returned as two-decimal strings in the API.
