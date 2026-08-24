# API

## Current implementation

The API currently exposes the technical health route and Phase 1 Client, Bike and WorkOrder routes through HITO 4. Authentication is intentionally absent until Phase 2; the later RBAC milestone will protect every business endpoint without changing these resource shapes.

```text
GET  /api/health

POST /api/clients
GET  /api/clients?search=
GET  /api/clients/:id

POST /api/bikes
GET  /api/bikes?plate=
GET  /api/bikes/:id

POST /api/work-orders
GET  /api/work-orders?status=&plate=&page=&pageSize=
GET  /api/work-orders/:id
POST /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
```

Status changes, history, authentication and user-administration endpoints are not implemented yet.

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

Authentication/roles: none through HITO 4.

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

Authentication/roles: none through HITO 4.

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

Authentication/roles: none through HITO 4. `id` must be a positive integer.

Success: `200 OK` with the public order, full Bike/Client graph, authoritative persisted total and an `items` array. Items expose `id`, `type`, `description`, `count` and `unitValue`; their mutations use the endpoints below.

Errors: `400 VALIDATION_ERROR`, `404 WORK_ORDER_NOT_FOUND`.

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
| Missing Client/Bike/WorkOrder/WorkOrderItem | 404 |
| Duplicate normalized plate | 409 |
| Unknown route | 404 |
| Unexpected failure | 500 |

## Planned assessment endpoints

The remaining contract is intentionally deferred to its approved milestones:

```text
PATCH  /api/work-orders/:id/status
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
