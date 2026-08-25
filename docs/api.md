# API REST

## Alcance implementado

La API expone las rutas completas de Fase 1 y Fase 2. Clientes, motocicletas, órdenes y usuarios requieren access JWT; sólo health y el ciclo login/refresh/logout son públicos.

```text
GET  /api/health

POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/register

GET   /api/users
PATCH /api/users/:id/role
PATCH /api/users/:id/active

POST /api/clients
GET  /api/clients?search=
GET  /api/clients/:id

POST /api/bikes
GET  /api/bikes?plate=
GET  /api/bikes/:id

POST   /api/work-orders
GET    /api/work-orders?status=&plate=&page=&pageSize=
GET    /api/work-orders/:id
GET    /api/work-orders/:id/history?page=&pageSize=
PATCH  /api/work-orders/:id/status
POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId
```

## Convenciones generales

- Prefijo `/api`; request/response JSON.
- API/JavaScript en `camelCase`; DB en `snake_case`.
- Recurso único: `{ "data": {} }`.
- Colección: `{ "data": [] }`; paginada agrega `meta`.
- Serializadores explícitos omiten metadata y campos sensibles.
- Validación puede incluir `details` de campos seguros.
- Body JSON máximo 100 KiB.
- CORS credentialed admite sólo `FRONTEND_ORIGIN`; clientes sin `Origin` como Postman siguen permitidos.
- Helmet aplica globalmente; CSP corresponde al host frontend.

Error estándar:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Error de validación:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "field": "name", "message": "Name is required." }]
  }
}
```

## Health

### `GET /api/health`

Público. Confirma que la aplicación Express responde; no expone secretos ni estado interno de MySQL.

## Autenticación

### Iniciar sesión

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@example.test", "password": "..." }
```

El email se recorta y convierte a minúsculas. Respuesta 200:

```json
{
  "data": {
    "user": {
      "id": 1,
      "name": "Workshop Admin",
      "email": "admin@example.test",
      "role": "ADMIN",
      "active": true
    },
    "accessToken": "<jwt>"
  }
}
```

También fija `pavas_refresh_token` como cookie `HttpOnly` con path `/api/auth`; el refresh nunca aparece en JSON. Email desconocido, contraseña incorrecta y usuario inactivo devuelven el mismo `401 INVALID_CREDENTIALS`; entrada inválida, 400; exceso de intentos, `429 LOGIN_RATE_LIMITED`.

### Renovar sesión

```http
POST /api/auth/refresh
Cookie: pavas_refresh_token=...
```

No requiere access token. Devuelve un nuevo `user`/`accessToken`, rota la cookie, revoca al predecesor y conserva la familia. Token ausente, inválido, expirado, revocado o reutilizado devuelve `401 INVALID_REFRESH_TOKEN`. Replay revoca sólo su familia.

### Cerrar sesión

```http
POST /api/auth/logout
Cookie: pavas_refresh_token=...
```

Respuesta:

```json
{ "data": { "loggedOut": true } }
```

Revoca el token actual si existe y limpia la cookie. Cookie ausente/inválida/revocada sigue siendo éxito idempotente.

### Usuario actual

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Devuelve `id`, `name`, `email`, `role`, `active`. Falta de credencial: `401 AUTHENTICATION_REQUIRED`; token malformado, expirado o desactualizado: `401 INVALID_ACCESS_TOKEN`.

### Registrar usuario

```http
POST /api/auth/register
Authorization: Bearer <ADMIN accessToken>
Content-Type: application/json

{
  "name": "Carlos Perez",
  "email": "carlos@example.com",
  "password": "at least 8 characters",
  "role": "MECANICO"
}
```

Sólo `ADMIN`. Nombre, email, password y rol son requeridos; password mínimo ocho caracteres. El usuario nace activo. `id`, `passwordHash`, `active` y timestamps enviados se ignoran. Éxito 201; email normalizado duplicado, `409 USER_EMAIL_ALREADY_EXISTS`; `MECANICO`, 403.

## Administración de usuarios

Todas las rutas requieren `ADMIN`. Respuestas: `id`, `name`, `email`, `role`, `active`, `createdAt`, `updatedAt`; nunca hash.

```text
GET   /api/users
PATCH /api/users/:id/role    { "role": "ADMIN" | "MECANICO" }
PATCH /api/users/:id/active  { "active": true | false }
```

El listado no pagina por el alcance acotado y ordena por nombre, email, ID. ID/rol/boolean inválido devuelve 400; ausente, `404 USER_NOT_FOUND`. Se permite cambiar el propio rol/estado; no existe protección del último ADMIN. El token afectado falla en su siguiente petición.

## Clientes

### Crear cliente

```http
POST /api/clients
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Juan Perez",
  "phone": "3001234567",
  "email": "juan@example.com"
}
```

Roles: `ADMIN`, `MECANICO`. `name`/`phone` requeridos; `email` opcional pero válido. Se recorta texto y normaliza email. Éxito 201 con campos públicos; errores `400 VALIDATION_ERROR`.

### Buscar clientes

```http
GET /api/clients?search=juan
Authorization: Bearer <accessToken>
```

`search` opcional busca parcialmente nombre, teléfono/email mediante Sequelize parametrizado. Sin query devuelve todos, ordenados por nombre/ID. Colección no paginada. Éxito 200 `{ "data": [] }`.

### Consultar cliente

```http
GET /api/clients/:id
Authorization: Bearer <accessToken>
```

ID entero positivo. Errores: `400 VALIDATION_ERROR`, `404 CLIENT_NOT_FOUND`.

## Motocicletas

### Crear motocicleta

```http
POST /api/bikes
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "plate": "abc 123",
  "brand": "Yamaha",
  "model": "FZ 2.0",
  "cylinder": 149,
  "clientId": 1
}
```

Roles: `ADMIN`, `MECANICO`. Placa, marca, modelo y `clientId` positivo requeridos; `cylinder` opcional y string nullable. Normalización `trim → uppercase → remove whitespace`; persiste `ABC123`. Cliente debe existir.

Éxito 201 con motocicleta y cliente anidado. Errores: 400, `404 CLIENT_NOT_FOUND`, `409 BIKE_PLATE_ALREADY_EXISTS`.

### Buscar motocicletas

```http
GET /api/bikes?plate=abc%20123
Authorization: Bearer <accessToken>
```

`plate` opcional, normalizada igual que al guardar, busca parcialmente. Sin query devuelve todas ordenadas por placa/ID e incluye cliente. No hay otros filtros/paginación.

### Consultar motocicleta

```http
GET /api/bikes/:id
Authorization: Bearer <accessToken>
```

Devuelve `id`, `plate`, `brand`, `model`, `cylinder`, `clientId`, `client`. Errores 400/`404 BIKE_NOT_FOUND`.

## Órdenes de trabajo

### Crear orden

```http
POST /api/work-orders
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "bikeId": 1,
  "entryDate": "2026-08-24T15:00:00.000Z",
  "faultDescription": "Abnormal transmission noise"
}
```

Roles: `ADMIN`, `MECANICO`. `bikeId`/descripción requeridos. `entryDate` es opcional; si existe debe incluir `Z` u offset y máximo milisegundos; si se omite usa hora de servidor.

El backend fija `RECIBIDA`/`0.00` y en la misma transacción crea `fromStatus=null`, `toStatus=RECIBIDA`, `note=null`, actor autenticado. Campos internos enviados se ignoran. Éxito 201 con Bike/Client e `items: []`; errores 400/`404 BIKE_NOT_FOUND`.

### Listar y filtrar órdenes

```http
GET /api/work-orders?status=RECIBIDA&plate=abc%20123&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

Queries opcionales:

- `status`: uno de `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`, `ENTREGADA`, `CANCELADA`;
- `plate`: búsqueda parcial normalizada;
- `page`: entero positivo, default 1;
- `pageSize`: 1–100, default 20.

Filtros combinan con AND. Cada fila incluye Bike/Client, no items. Orden: `entryDate DESC, id DESC`.

```json
{
  "data": [{
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
      "client": { "id": 1, "name": "Juan Perez", "phone": "3001234567", "email": "juan@example.com" }
    }
  }],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }
}
```

Sin resultados, ambos totales son cero. Query inválida: `400 VALIDATION_ERROR`.

### Detalle de orden

```http
GET /api/work-orders/:id
Authorization: Bearer <accessToken>
```

Devuelve orden, Bike/Client, total persistido e `items` con `id`, `type`, `description`, `count`, `unitValue`. Errores 400/`404 WORK_ORDER_NOT_FOUND`.

### Cambiar estado

```http
PATCH /api/work-orders/:id/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "toStatus": "DIAGNOSTICO", "note": "Initial diagnosis completed" }
```

`toStatus` requerido. `note` acepta string/null, se recorta y limita a 1000. El cambio y un único evento se ejecutan en transacción con `FOR UPDATE`.

| Actual | Destinos |
|---|---|
| `RECIBIDA` | `DIAGNOSTICO`, `CANCELADA` |
| `DIAGNOSTICO` | `EN_PROCESO`, `CANCELADA` |
| `EN_PROCESO` | `LISTA`, `CANCELADA` |
| `LISTA` | `ENTREGADA`, `CANCELADA` |
| `ENTREGADA` | ninguno |
| `CANCELADA` | ninguno |

`ADMIN` ejecuta cualquier arista válida; `MECANICO` sólo apunta a `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`. Una arista inválida para todos es 400; una válida pero prohibida es 403.

```json
{ "data": { "id": 10, "status": "DIAGNOSTICO" } }
```

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition work order from ENTREGADA to CANCELADA."
  }
}
```

Errores: `400 VALIDATION_ERROR`, `400 INVALID_STATUS_TRANSITION`, 403, `404 WORK_ORDER_NOT_FOUND`, 500 seguro.

### Consultar historial

```http
GET /api/work-orders/:id/history?page=1&pageSize=20
Authorization: Bearer <accessToken>
```

Roles: ambos. `pageSize` máximo 100. Orden `createdAt DESC, id DESC`; actor sólo ID/nombre.

```json
{
  "data": [
    {
      "id": 2,
      "fromStatus": "RECIBIDA",
      "toStatus": "DIAGNOSTICO",
      "note": "Initial diagnosis completed",
      "createdAt": "2026-08-24T16:00:00.000Z",
      "changedBy": { "id": 1, "name": "Workshop Admin" }
    },
    {
      "id": 1,
      "fromStatus": null,
      "toStatus": "RECIBIDA",
      "note": null,
      "createdAt": "2026-08-24T15:00:00.000Z",
      "changedBy": { "id": 1, "name": "Workshop Admin" }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 2, "totalPages": 1 }
}
```

Errores: 400, 401, `404 WORK_ORDER_NOT_FOUND`.

### Agregar ítem

```http
POST /api/work-orders/:id/items
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "type": "MANO_OBRA",
  "description": "General inspection",
  "count": "1.50",
  "unitValue": "50000.00"
}
```

Ambos roles. `type` es `MANO_OBRA`/`REPUESTO`; descripción máximo 255; `count > 0`; `unitValue >= 0`; máximo dos decimales. Number JSON o string decimal se normaliza a string de dos decimales. El service bloquea orden, crea, suma en MySQL y persiste total.

```json
{
  "data": {
    "item": { "id": 1, "type": "MANO_OBRA", "description": "General inspection", "count": "1.50", "unitValue": "50000.00" },
    "workOrderTotal": "75000.00"
  }
}
```

Éxito 201; errores 400/`404 WORK_ORDER_NOT_FOUND`/500 seguro.

### Eliminar ítem

```http
DELETE /api/work-orders/items/:itemId
Authorization: Bearer <ADMIN accessToken>
```

Sólo `ADMIN`; `MECANICO` recibe 403 antes de validar ID. Se resuelve orden, se bloquea, se relee ítem, elimina y recalcula. Último ítem deja `0.00`.

```json
{ "data": { "deletedItemId": 1, "workOrderTotal": "0.00" } }
```

Errores: 400/403/`404 WORK_ORDER_ITEM_NOT_FOUND`/500 seguro.

## Códigos HTTP

| Código | Uso |
|---:|---|
| 200 | lectura, actualización, refresh o logout exitoso |
| 201 | creación exitosa |
| 400 | validación, JSON inválido o transición inválida/idempotente |
| 401 | autenticación ausente/inválida/expirada |
| 403 | rol sin permiso u origen CORS denegado |
| 404 | recurso o ruta ausente |
| 409 | placa o email normalizado duplicado |
| 413 | JSON superior a 100 KiB |
| 429 | límite de intentos de login |
| 500 | fallo inesperado sanitizado |
