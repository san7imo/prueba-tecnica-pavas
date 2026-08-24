# API

## Current implementation

HITO 2 exposes the technical health route and the six Phase 1 Client/Bike routes. Authentication is intentionally absent until Phase 2; the later RBAC milestone will protect every business endpoint without changing these resource shapes.

```text
GET  /api/health

POST /api/clients
GET  /api/clients?search=
GET  /api/clients/:id

POST /api/bikes
GET  /api/bikes?plate=
GET  /api/bikes/:id
```

Work-order, item, status, history, authentication and user-administration endpoints are not implemented yet.

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

## HTTP status mapping

| Condition | Status |
|---|---:|
| Successful read | 200 |
| Successful creation | 201 |
| Validation failure | 400 |
| Missing Client/Bike | 404 |
| Duplicate normalized plate | 409 |
| Unknown route | 404 |
| Unexpected failure | 500 |

## Planned assessment endpoints

The remaining contract is intentionally deferred to its approved milestones:

```text
POST   /api/work-orders
GET    /api/work-orders?status=&plate=&page=&pageSize=
GET    /api/work-orders/:id
PATCH  /api/work-orders/:id/status
POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
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
