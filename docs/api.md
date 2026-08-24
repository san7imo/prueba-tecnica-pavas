# API Conventions

## Current implementation

Only the technical endpoint below exists in HITO 0:

```http
GET /api/health
```

```json
{
  "status": "ok"
}
```

The remaining paths in this document are planned contracts from the assessment and must not be represented as currently available.

## General conventions

- Base prefix: `/api`.
- JSON requests and responses.
- Route/controller/service separation.
- Authentication required for every business route after Phase 2 security is introduced.

Single resource:

```json
{
  "data": {}
}
```

Collection:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Safe validation details may be included. Stack traces, SQL messages, JWT internals, secrets and hashes are prohibited.

## Planned assessment endpoints

```text
POST   /api/clients
GET    /api/clients?search=
GET    /api/clients/:id

POST   /api/bikes
GET    /api/bikes?plate=
GET    /api/bikes/:id

POST   /api/work-orders
GET    /api/work-orders?status=&plate=&page=&pageSize=
GET    /api/work-orders/:id
PATCH  /api/work-orders/:id/status
POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
GET    /api/work-orders/:id/history?page=&pageSize=

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/users
PATCH  /api/users/:id/role
PATCH  /api/users/:id/active
```

Each endpoint will be documented with authentication, roles, parameters, body, response and errors when implemented.

## Pagination

Work-order and history collections use positive integer `page` and `pageSize`. History defaults to 20, caps page size at 100 and orders by `created_at DESC, id DESC`.

## HTTP status mapping

| Condition | Status |
|---|---:|
| Successful read/update | 200 |
| Successful creation | 201 |
| Successful empty deletion | 204 |
| Validation/invalid transition | 400 |
| Missing/invalid authentication | 401 |
| Authenticated but forbidden | 403 |
| Missing resource | 404 |
| Duplicate plate/email | 409 |
| Login throttled | 429 |
| Unexpected failure | 500 |

