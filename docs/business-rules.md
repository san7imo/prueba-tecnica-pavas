# Business Rules

## Status

These rules are the approved domain contract. Phase 1 behavior, authentication, HITO 8 backend authorization and HITO 9 audit history are implemented.

## Work-order state machine

```mermaid
stateDiagram-v2
    [*] --> RECIBIDA
    RECIBIDA --> DIAGNOSTICO
    DIAGNOSTICO --> EN_PROCESO
    EN_PROCESO --> LISTA
    LISTA --> ENTREGADA
    RECIBIDA --> CANCELADA
    DIAGNOSTICO --> CANCELADA
    EN_PROCESO --> CANCELADA
    LISTA --> CANCELADA
```

Canonical transition map:

```javascript
{
  RECIBIDA: ['DIAGNOSTICO', 'CANCELADA'],
  DIAGNOSTICO: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['LISTA', 'CANCELADA'],
  LISTA: ['ENTREGADA', 'CANCELADA'],
  ENTREGADA: [],
  CANCELADA: [],
}
```

| From | Allowed targets |
|---|---|
| `RECIBIDA` | `DIAGNOSTICO`, `CANCELADA` |
| `DIAGNOSTICO` | `EN_PROCESO`, `CANCELADA` |
| `EN_PROCESO` | `LISTA`, `CANCELADA` |
| `LISTA` | `ENTREGADA`, `CANCELADA` |
| `ENTREGADA` | — |
| `CANCELADA` | — |

- `ENTREGADA` and `CANCELADA` are terminal.
- ADMIN rollback from `ENTREGADA` is optional in the source and deliberately excluded.
- Unknown target states are request validation errors; known but disallowed transitions return HTTP 400 with `INVALID_STATUS_TRANSITION`.
- A same-state request is rejected and never creates history.
- The service locks the WorkOrder row inside a transaction and validates from the status read under that lock. Competing transitions therefore behave as a legal serial ordering rather than overwriting from stale state.
- The optional `note` field is accepted, trimmed, capped at 1000 characters and persisted only in the audit row for a valid transition.

## Work-order creation

- A valid existing Bike is required; the database FK remains the final integrity barrier.
- `entryDate` accepts an unambiguous ISO 8601 date-time with timezone and defaults to current server time when omitted.
- Every API-created order starts in `RECIBIDA` with persisted total `0.00`.
- Client-supplied `status`, `total`, IDs and timestamps are ignored through explicit whitelists.
- The order and its initial `NULL -> RECIBIDA` event commit or roll back together; the event always identifies the authenticated creator and uses a null note.

## Audit history

- Work-order creation atomically records `NULL -> RECIBIDA` with the authenticated creator.
- Every valid later transition creates exactly one immutable history row in the same transaction.
- Cancellation is audited.
- Rejected and idempotent transitions create no row.
- History is ordered by `created_at DESC, id DESC`.
- History defaults to page 1 and page size 20; page size is capped at 100.
- A missing parent order returns 404 instead of an empty history response.
- Both roles may read history; records expose only actor ID/name and have no update/delete API.
- An indexed query and a test with more than 100 events support the source `<1s` display target under assessment-scale local data.

## Work-order items

```text
type in MANO_OBRA | REPUESTO
count > 0
unitValue >= 0
```

Both roles can create either item type through `POST /api/work-orders/:id/items`. Only ADMIN can call `DELETE /api/work-orders/items/:itemId`; MECANICO receives HTTP 403 without changing the item or total.

Inputs accept at most two decimal places and are normalized to fixed-scale decimal strings. `count` must fit `DECIMAL(10,2)` and `unitValue` must fit `DECIMAL(15,2)`. HITO 1 model validation and named MySQL CHECK constraints remain the persistence barriers.

Item mutation and total recalculation are atomic. The owning WorkOrder row is locked with `FOR UPDATE`, and the mutation, aggregate and stored total either all commit or all roll back. A deletion revalidates the item after acquiring the order lock so a concurrent change cannot produce a stale total.

## Total

```text
total = SUM(item.count * item.unitValue)
```

The backend is authoritative. The frontend may display a preview but cannot submit an authoritative persisted total. MySQL evaluates the aggregate with `DECIMAL`, casts the final value to `DECIMAL(15,2)` and returns a string; JavaScript `Number` is never used for monetary calculation. Deleting the final item produces `0.00`.

Example:

```text
2 * 50,000 + 1 * 30,000 = 130,000
```

## Plate normalization

Plate values are trimmed, uppercased and stripped of unnecessary spaces before storage/search. Uniqueness is enforced in the application and database. No Colombian-format regex is assumed.

## Role matrix

| Action | ADMIN | MECANICO |
|---|---:|---:|
| Read clients/bikes/orders | Yes | Yes |
| Create clients/bikes/orders | Yes | Yes |
| Create items | Yes | Yes |
| Delete items | Yes | No |
| Move to `DIAGNOSTICO` | Yes | Yes |
| Move to `EN_PROCESO` | Yes | Yes |
| Move to `LISTA` | Yes | Yes |
| Move to `ENTREGADA` | Yes | No |
| Move to `CANCELADA` | Yes | No |
| View history | Yes | Yes |
| Administer users | Yes | No |

All business endpoints require authentication. Static role middleware runs before request validators. For state changes, the locked service validates the workflow before actor permission: invalid graph edge is 400, while a workflow-valid forbidden target is 403. UI hiding is not an authorization boundary.

User self-deactivation and self-role change are allowed. The affected access token fails its next request; preserving a last ADMIN is an operational concern deliberately outside this MVP milestone.

## Authentication rules

- Inactive users cannot authenticate.
- Login errors are generic.
- Passwords use bcrypt with cost at least 10.
- Passwords and hashes never appear in responses.
- Access JWTs are short-lived.
- Refresh tokens are HttpOnly, persisted only as digests, rotated and revocable.
- Reuse of a rotated token revokes its active token family and returns 401.
- Each login creates an independent family; replay or logout never revokes other login families.
- `/auth/me` reloads the user, so inactive users lose access immediately rather than only when the access JWT expires.
- Refresh rotation is serialized with a row lock; a concurrent second use is treated as replay and leaves no active compromised descendant.
