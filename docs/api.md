# API

## Current implementation

The API exposes the technical health route, complete Phase 1 Client/Bike/WorkOrder routes and the HITO 7 authentication/session routes. HITO 8 will protect business endpoints and add RBAC without changing their resource shapes.

```text
GET  /api/health

POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me

POST /api/clients
GET  /api/clients?search=
GET  /api/clients/:id

POST /api/bikes
GET  /api/bikes?plate=
GET  /api/bikes/:id

POST /api/work-orders
GET  /api/work-orders?status=&plate=&page=&pageSize=
GET  /api/work-orders/:id
PATCH /api/work-orders/:id/status
POST /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
```

History, registration and user-administration endpoints are not implemented yet.

## General conventions

- Base prefix: `/api`.
- JSON request and response bodies.
- API/JavaScript fields use `camelCase`; database fields use `snake_case`.
- Single resources use `{ "data": {} }`; these unpaginated collections use `{ "data": [] }`.
- Public serializers expose only documented fields and omit Sequelize metadata/timestamps.
- Validation failures may include safe field-level `details`.
- Stack traces, SQL errors and environment internals are never returned.

Standard error:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Authentication

### Login

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@example.test", "password": "..." }
```

Email is trimmed/lowercased. Valid credentials return `200` with `{ data: { user, accessToken } }` and set `pavas_refresh_token` as an HttpOnly cookie scoped to `/api/auth`. The refresh value is never returned in JSON. Unknown email, wrong password and inactive account all return `401 INVALID_CREDENTIALS`; malformed input returns `400 VALIDATION_ERROR`; excess attempts return `429 LOGIN_RATE_LIMITED`.

### Refresh

```http
POST /api/auth/refresh
Cookie: pavas_refresh_token=...
```

No access token is required. Success returns a new `{ data: { user, accessToken } }`, sets a rotated refresh cookie, revokes the predecessor and retains its family. Missing, invalid, expired, revoked or replayed tokens return `401 INVALID_REFRESH_TOKEN`. Replay of a rotated token revokes that family only.

### Logout

```http
POST /api/auth/logout
Cookie: pavas_refresh_token=...
```

Returns `200 { data: { loggedOut: true } }`, revokes the current token when found and clears the cookie. Missing, invalid or already-revoked cookies remain a safe, idempotent success.

### Current user

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Returns `id`, `name`, `email`, `role` and `active`. The middleware verifies the JWT then reloads the active user from MySQL. Missing credentials return `401 AUTHENTICATION_REQUIRED`; malformed/expired/stale tokens return `401 INVALID_ACCESS_TOKEN`. No password/hash field is serialized.

Validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "field": "name", "message": "Name is required." }
    ]
  }
}
```

## Clients

### Create client

```http
POST /api/clients
Content-Type: application/json
```

Authentication/roles: none in HITO 2.

```json
{
  "name": "Juan Perez",
  "phone": "3001234567",
  "email": "juan@example.com"
}
```

`name` and `phone` are required strings. `email` is optional but must be valid when supplied. Text is trimmed and email is lowercased. Undocumented input fields are not passed to persistence.

Success: `201 Created` with `id`, `name`, `phone` and nullable `email` under `data`.

Errors: `400 VALIDATION_ERROR`.

### List/search clients

```http
GET /api/clients?search=juan
```

Authentication/roles: none in HITO 2.

`search` is optional. A non-empty value performs a partial, parameterized MySQL search across name, phone and email. Omitting it returns all clients ordered by name then ID. This assessment endpoint is intentionally unpaginated.

Success: `200 OK` with `{ "data": [] }`.

Errors: `400 VALIDATION_ERROR` for malformed query values.

### Get client

```http
GET /api/clients/:id
```

Authentication/roles: none in HITO 2. `id` must be a positive integer.

Success: `200 OK` with the public client under `data`.

Errors: `400 VALIDATION_ERROR`, `404 CLIENT_NOT_FOUND`.

## Bikes

### Create bike

```http
POST /api/bikes
Content-Type: application/json
```

Authentication/roles: none in HITO 2.

```json
{
  "plate": "abc 123",
  "brand": "Yamaha",
  "model": "FZ 2.0",
  "cylinder": 149,
  "clientId": 1
}
```

`plate`, `brand`, `model` and a positive `clientId` are required. `cylinder` is optional and stored as a nullable string. Plate normalization is `trim → uppercase → remove whitespace`, so the example persists as `ABC123`. No country-specific plate format is imposed. The related client must exist.

Success: `201 Created` with public bike fields and its nested public client.

Errors: `400 VALIDATION_ERROR`, `404 CLIENT_NOT_FOUND`, `409 BIKE_PLATE_ALREADY_EXISTS`.

### List/search bikes

```http
GET /api/bikes?plate=abc%20123
```

Authentication/roles: none in HITO 2.

`plate` is optional and receives the same normalization as persisted plates. A non-empty value performs a partial plate search; omitting it returns all bikes. Results are ordered by plate then ID and include the client relation. No extra brand/model filters or pagination are introduced.

Success: `200 OK` with `{ "data": [] }`.

Errors: `400 VALIDATION_ERROR` for malformed query values.

### Get bike

```http
GET /api/bikes/:id
```

Authentication/roles: none in HITO 2. `id` must be a positive integer.

Success: `200 OK` with `id`, `plate`, `brand`, `model`, nullable `cylinder`, `clientId` and nested `client`.

Errors: `400 VALIDATION_ERROR`, `404 BIKE_NOT_FOUND`.

## Work Orders

### Create work order

```http
POST /api/work-orders
Content-Type: application/json
```

Authentication/roles: none through HITO 5.

```json
{
  "bikeId": 1,
  "entryDate": "2026-08-24T15:00:00.000Z",
  "faultDescription": "Abnormal transmission noise"
}
```

`bikeId` and a non-empty `faultDescription` are required. `entryDate` is optional: when present it must be a valid ISO 8601 date-time with an explicit `Z`/UTC offset and up to millisecond precision; when omitted, the backend uses current server time. The related Bike must exist.

The backend always persists `status=RECIBIDA` and `total=0.00`. Input fields such as `id`, `status`, `total`, `createdAt` and `updatedAt` are ignored by explicit validator/service/repository whitelists.

Success: `201 Created` with the order, nested Bike/Client and `items: []`.

Errors: `400 VALIDATION_ERROR`, `404 BIKE_NOT_FOUND`.

### List/filter work orders

```http
GET /api/work-orders?status=RECIBIDA&plate=abc%20123&page=1&pageSize=20
```

Authentication/roles: none through HITO 5.

All parameters are optional:

- `status`: one exact canonical value from `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`, `ENTREGADA`, `CANCELADA`;
- `plate`: partial search after trim, uppercase and whitespace removal;
- `page`: positive integer, default 1;
- `pageSize`: integer from 1 to 100, default 20.

Status and plate filters combine with AND. Results include Bike and Client in one eager query graph and are ordered by `entryDate DESC, id DESC`. Items are omitted from list rows and exposed only by detail.

```json
{
  "data": [
    {
      "id": 1,
      "bikeId": 1,
      "entryDate": "2026-08-24T15:00:00.000Z",
      "faultDescription": "Abnormal transmission noise",
      "status": "RECIBIDA",
      "total": "0.00",
      "bike": {
        "id": 1,
        "plate": "ABC123",
        "brand": "Yamaha",
        "model": "FZ 2.0",
        "cylinder": "149",
        "clientId": 1,
        "client": {
          "id": 1,
          "name": "Juan Perez",
          "phone": "3001234567",
          "email": "juan@example.com"
        }
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

For an empty result, `totalItems` and `totalPages` are both zero.

Errors: `400 VALIDATION_ERROR` for invalid status/pagination/filter values.

### Get work-order detail

```http
GET /api/work-orders/:id
```

Authentication/roles: none through HITO 5. `id` must be a positive integer.

Success: `200 OK` with the public order, full Bike/Client graph, authoritative persisted total and an `items` array. Items expose `id`, `type`, `description`, `count` and `unitValue`; their mutations use the endpoints below.

Errors: `400 VALIDATION_ERROR`, `404 WORK_ORDER_NOT_FOUND`.

### Update work-order status

```http
PATCH /api/work-orders/:id/status
Content-Type: application/json
```

Authentication/roles: none in the current pre-auth Phase 1 API. HITO 8 will apply the ADMIN/MECANICO policy. `id` must be a positive integer.

```json
{
  "toStatus": "DIAGNOSTICO",
  "note": "Initial diagnosis completed"
}
```

`toStatus` is required and must be one of the six canonical states. `note` is optional, accepts a string or `null`, is trimmed and is limited to 1000 characters. HITO 5 accepts but does not persist or return the note; Phase 2 audit history will consume the same body shape.

Allowed transitions:

| Current | Allowed targets |
|---|---|
| `RECIBIDA` | `DIAGNOSTICO`, `CANCELADA` |
| `DIAGNOSTICO` | `EN_PROCESO`, `CANCELADA` |
| `EN_PROCESO` | `LISTA`, `CANCELADA` |
| `LISTA` | `ENTREGADA`, `CANCELADA` |
| `ENTREGADA` | none |
| `CANCELADA` | none |

The service starts a transaction and locks the WorkOrder before reading and validating its current status. Same-state requests and every known but disallowed edge return the stable business error below.

Success: `200 OK`.

```json
{
  "data": {
    "id": 10,
    "status": "DIAGNOSTICO"
  }
}
```

Invalid transition: `400 Bad Request`.

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition work order from ENTREGADA to CANCELADA."
  }
}
```

Errors: `400 VALIDATION_ERROR` for an unknown target/malformed input, `400 INVALID_STATUS_TRANSITION` for a known disallowed edge, `404 WORK_ORDER_NOT_FOUND` for a missing order, and safe `500 INTERNAL_ERROR` for an unexpected transactional failure.

### Add work-order item

```http
POST /api/work-orders/:id/items
Content-Type: application/json
```

Authentication/roles: none in the current pre-auth Phase 1 API. HITO 8 will allow ADMIN and MECANICO.

```json
{
  "type": "MANO_OBRA",
  "description": "General inspection",
  "count": "1.50",
  "unitValue": "50000.00"
}
```

`type` is `MANO_OBRA` or `REPUESTO`; description is required and capped at 255 characters. `count` must be greater than zero and fit `DECIMAL(10,2)`. `unitValue` may be zero and must fit `DECIMAL(15,2)`. Numeric JSON values and decimal strings are accepted, normalized to two-decimal strings and never used as an authoritative total.

The service starts a transaction, locks the WorkOrder row, inserts the item, recalculates from all persisted items using MySQL decimal arithmetic and persists the total before commit.

Success: `201 Created`.

```json
{
  "data": {
    "item": {
      "id": 1,
      "type": "MANO_OBRA",
      "description": "General inspection",
      "count": "1.50",
      "unitValue": "50000.00"
    },
    "workOrderTotal": "75000.00"
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 WORK_ORDER_NOT_FOUND`, safe `500 INTERNAL_ERROR` on unexpected transactional failure.

### Delete work-order item

```http
DELETE /api/work-orders/items/:itemId
```

Authentication/roles: none in the current pre-auth Phase 1 API. HITO 8 will restrict this operation to ADMIN. `itemId` must be a positive integer.

The owning WorkOrder is resolved, then its row is locked inside a transaction. The item is revalidated with a locking read, deleted, and the exact total is recalculated before commit. Deleting the last item returns and persists `0.00`.

Success: `200 OK`.

```json
{
  "data": {
    "deletedItemId": 1,
    "workOrderTotal": "0.00"
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 WORK_ORDER_ITEM_NOT_FOUND`, safe `500 INTERNAL_ERROR` on unexpected transactional failure.

## HTTP status mapping

| Condition | Status |
|---|---:|
| Successful read | 200 |
| Successful creation | 201 |
| Validation failure | 400 |
| Invalid or same-state WorkOrder transition | 400 |
| Missing Client/Bike/WorkOrder/WorkOrderItem | 404 |
| Duplicate normalized plate | 409 |
| Unknown route | 404 |
| Unexpected failure | 500 |

## Planned assessment endpoints

The remaining contract is intentionally deferred to its approved milestones:

```text
GET    /api/work-orders/:id/history?page=&pageSize=

POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me

GET   /api/users
PATCH /api/users/:id/role
PATCH /api/users/:id/active
```
