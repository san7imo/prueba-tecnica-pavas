# API REST

## Alcance implementado

La API expone las rutas completas de las fases 1 y 2 y del producto vigente,
incluida la identificación única añadida después de HITO 20. Clientes,
motocicletas, órdenes, usuarios y auditoría requieren
access JWT; sólo health y el ciclo login/refresh/logout son públicos.

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
GET  /api/clients?documentNumber=&search=&lifecycle=&page=&pageSize=
GET  /api/clients/:id
PATCH /api/clients/:id
DELETE /api/clients/:id
POST /api/clients/:id/restore

POST /api/bikes
GET  /api/bikes?plate=&platePrefix=&clientId=&clientDocumentNumber=&lifecycle=&page=&pageSize=
GET  /api/bikes/:id
PATCH /api/bikes/:id
PATCH /api/bikes/:id/owner
DELETE /api/bikes/:id
POST /api/bikes/:id/restore

POST   /api/work-orders
GET    /api/work-orders?status=&plate=&bikeId=&clientDocumentNumber=&scope=&assignedMechanicId=&page=&pageSize=
GET    /api/work-orders/:id
GET    /api/work-orders/:id/history?page=&pageSize=
PATCH  /api/work-orders/:id/assignment
PATCH  /api/work-orders/:id/status
POST   /api/work-orders/:id/reopen
POST   /api/work-orders/:id/items
DELETE /api/work-orders/items/:itemId

GET /api/audit-events?entityType=&entityId=&action=&actorUserId=&dateFrom=&dateTo=&page=&pageSize=
GET /api/audit-events/:id
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
PATCH /api/users/:id/role    { "role": "ADMIN" | "MECANICO", "reason": "..." }
PATCH /api/users/:id/active  { "active": true | false, "reason": "..." }
```

El listado no pagina por el alcance acotado y ordena por nombre, email, ID. Toda
mutación exige `reason` no vacío de máximo 1000 caracteres y crea auditoría
`ROLE_CHANGED`, `DEACTIVATED` o `ACTIVATED`. ID/rol/boolean inválido devuelve
400; ausente, `404 USER_NOT_FOUND`.

Desactivar o retirar el rol al último `ADMIN` activo responde
`409 LAST_ACTIVE_ADMIN_REQUIRED`. Un `MECANICO` con órdenes abiertas asignadas
no puede desactivarse ni cambiar a `ADMIN`: responde
`409 MECHANIC_HAS_OPEN_ORDERS`; la UI ofrece el acceso seguro a la cola filtrada
para reasignarlas. Los usuarios implicados se bloquean en orden determinista y las
reglas se revalidan dentro de la transacción; el token afectado por un cambio
válido falla en su siguiente petición.

## Auditoría empresarial global

Sólo `ADMIN`. La colección acepta filtros opcionales `entityType`, `entityId`,
`action`, `actorUserId`, `dateFrom` y `dateTo`, además de paginación 1/20 con
máximo 100. Fechas requieren ISO 8601 con zona. El orden es
`createdAt DESC, id DESC`.

```http
GET /api/audit-events?entityType=WORK_ORDER&action=STATUS_CHANGED&page=1&pageSize=20
Authorization: Bearer <ADMIN accessToken>
```

Cada resultado expone `id`, `entityType`, `entityId`, `action`, actor seguro
(`id`, `name`), `beforeData`, `afterData`, `metadata`, `reason` y `createdAt`.
El detalle usa `GET /api/audit-events/:id`; un ID ausente devuelve
`404 AUDIT_EVENT_NOT_FOUND`. `MECANICO` recibe 403. No existen rutas POST,
PATCH, PUT o DELETE para el audit.

## Clientes

### Crear cliente

```http
POST /api/clients
Authorization: Bearer <ADMIN accessToken>
Content-Type: application/json

{
  "documentNumber": "1.020.304.050",
  "name": "Juan Perez",
  "phone": "3001234567",
  "email": "juan@example.com",
  "confirmDuplicate": false
}
```

Sólo `ADMIN`. `documentNumber` es obligatorio, elimina puntos, espacios y
guiones, y debe contener entre 5 y 20 dígitos. Se almacena como string para
preservar ceros iniciales. Nombre usa trim; email opcional usa trim/lowercase. Teléfono
retira espacios, guiones, puntos y paréntesis, conserva un `+` inicial y exige
7–20 dígitos. Una coincidencia activa exacta de phone/email devuelve
`409 CLIENT_DUPLICATE_RISK` con `candidateIds`/`matchedFields` seguros. Si son
personas distintas puede reenviarse `confirmDuplicate: true` junto con
`duplicateReason`; el override queda auditado. Una coincidencia eliminada
siempre devuelve `409 CLIENT_RESTORE_REQUIRED`. La cédula es globalmente única
incluso para clientes eliminados: una coincidencia activa devuelve
`409 CLIENT_DOCUMENT_ALREADY_EXISTS` y una eliminada exige restauración; no
existe override para duplicar una cédula.

### Buscar clientes

```http
GET /api/clients?documentNumber=1020304050&lifecycle=active&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

`documentNumber` realiza la búsqueda principal por igualdad exacta después de
normalizar la cédula y aprovecha su índice único. `search` conserva la búsqueda
secundaria parcial por nombre/email y reconoce teléfono con formato humano
contra su forma canónica. Ambos filtros, si se envían juntos, combinan con AND.
`lifecycle` admite `active` (default),
`deleted` y `all`; sólo `ADMIN` puede solicitar los dos últimos. Página default
1/20, máximo 100; orden nombre/ID. Devuelve `{ "data": [], "meta": {} }`.

### Consultar cliente

```http
GET /api/clients/:id
Authorization: Bearer <accessToken>
```

ID técnico entero positivo. Ambos roles leen activos; un detalle eliminado es sólo
`ADMIN`. La respuesta incluye `documentNumber` y añade `lifecycle`, `deletedAt`, `deletedByUserId` y
`deleteReason`. Errores: 400, `404 CLIENT_NOT_FOUND`, 403 para un mecánico que
intenta leer un eliminado.

### Actualizar cliente

```http
PATCH /api/clients/:id
Authorization: Bearer <ADMIN accessToken>
Content-Type: application/json

{ "documentNumber": "1020304051", "name": "Nuevo nombre", "phone": "+57 300 123 4567", "email": null }
```

Acepta al menos uno de `documentNumber`, `name`, `phone`, `email`; `null` elimina el email. Un
cliente eliminado responde `409 CLIENT_INACTIVE`. Los cambios efectivos crean
`UPDATED`; un payload idempotente retorna el recurso sin inventar un evento.
Cambiar phone/email aplica la misma política de duplicados y override que create;
cambiar cédula conserva la unicidad global y queda incluido en el snapshot auditado.

### Eliminar y restaurar

```http
DELETE /api/clients/:id
Authorization: Bearer <ADMIN accessToken>
Content-Type: application/json

{ "reason": "Cliente solicitó archivar su registro" }
```

Delete es lógico y requiere reason. Persiste `deletedAt`, actor y razón; nunca
borra motos/órdenes. Con motos activas responde `409 CLIENT_HAS_ACTIVE_BIKES`;
si ya estaba eliminado, `409 CLIENT_ALREADY_DELETED`.

```http
POST /api/clients/:id/restore
Authorization: Bearer <ADMIN accessToken>
Content-Type: application/json

{ "reason": "Cliente regresó al taller" }
```

Restore limpia los tres campos lifecycle, no restaura motocicletas y audita el
estado anterior. Un activo responde `409 CLIENT_NOT_DELETED`. Si sus contactos
coinciden con otro activo, exige `confirmDuplicate: true` y `duplicateReason`;
ambas justificaciones quedan en el evento `RESTORED`.

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

Sólo `ADMIN`. Placa, marca, modelo y `clientId` positivo son requeridos; `cylinder` es opcional y nullable. Normalización `trim → uppercase → remove whitespace`; persiste `ABC123`. El cliente debe existir y estar activo.

Éxito 201 con lifecycle y propietario activo anidado. Errores: 400, `404 CLIENT_NOT_FOUND`, `409 CLIENT_INACTIVE`, `409 BIKE_PLATE_ALREADY_EXISTS` para placa activa y `409 BIKE_RESTORE_REQUIRED` para una placa perteneciente a una moto eliminada. La placa sigue reservada globalmente después del soft delete.

### Buscar motocicletas

```http
GET /api/bikes?plate=abc%20123&clientDocumentNumber=1020304050&lifecycle=active&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

Filtros opcionales:

- `plate`: igualdad exacta tras normalización;
- `platePrefix`: prefijo normalizado indexable;
- `clientId`: propietario positivo;
- `clientDocumentNumber`: cédula exacta y normalizada del propietario;
- `lifecycle`: `active` por defecto, `deleted` o `all`;
- `page`: entero positivo, default 1;
- `pageSize`: 1–100, default 20.

`plate` y `platePrefix` son mutuamente excluyentes; combinarlos devuelve `400 INVALID_QUERY_FILTERS`. No se realizan búsquedas de placa con wildcard inicial. Ambos roles leen `active`; sólo `ADMIN` puede solicitar `deleted/all`. La respuesta incluye `meta`, lifecycle y propietario anidado.

### Consultar motocicleta

```http
GET /api/bikes/:id
Authorization: Bearer <accessToken>
```

Ambos roles leen una motocicleta activa; sólo `ADMIN` puede leer una eliminada. Devuelve los campos administrados, lifecycle, propietario y `currentOpenOrder`, que es `null` o un resumen con ID, fecha de entrada, falla, estado y total. Errores 400/403/`404 BIKE_NOT_FOUND`.

El historial completo se obtiene paginado mediante `GET /api/work-orders?bikeId=:id` y conserva órdenes abiertas y cerradas bajo la misma identidad de motocicleta.

### Editar motocicleta

```http
PATCH /api/bikes/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "plate": "ABC124", "brand": "Honda", "cylinder": null }
```

Sólo `ADMIN`. Acepta al menos uno de `plate`, `brand`, `model`, `cylinder`; no permite cambiar propietario ni lifecycle por este endpoint. Un no-op no genera auditoría. Una moto eliminada devuelve `409 BIKE_INACTIVE`; las colisiones de placa distinguen recurso activo de eliminado.

### Cambiar propietario

```http
PATCH /api/bikes/:id/owner
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "clientId": 2, "reason": "Traspaso confirmado por el cliente" }
```

Sólo `ADMIN`; cliente destino activo y razón no vacía son obligatorios. La operación bloquea clientes por ID y luego la motocicleta, conserva todas las órdenes históricas bajo el mismo `bikeId` y genera `OWNER_CHANGED` con propietario anterior/nuevo. Una moto eliminada devuelve `409 BIKE_INACTIVE`.

### Eliminar y restaurar motocicleta

```http
DELETE /api/bikes/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "reason": "Retirada temporal del servicio" }
```

El soft delete sólo lo realiza `ADMIN`, exige razón y nunca elimina órdenes o ítems. Una orden en `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO` o `LISTA` bloquea con `409 BIKE_HAS_ACTIVE_WORK_ORDER`. Repetir devuelve `409 BIKE_ALREADY_DELETED`.

```http
POST /api/bikes/:id/restore
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "reason": "Motocicleta nuevamente operativa" }
```

Restore limpia los tres campos lifecycle y conserva placa, propietario e historia. Exige propietario activo; de lo contrario devuelve `409 BIKE_OWNER_INACTIVE`. Una moto ya activa devuelve `409 BIKE_NOT_DELETED`. Delete y restore son auditados en la misma transacción.

## Órdenes de trabajo

### Crear orden

```http
POST /api/work-orders
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "bikeId": 1,
  "entryDate": "2026-08-24T15:00:00.000Z",
  "faultDescription": "Abnormal transmission noise",
  "assignedMechanicId": 12
}
```

Sólo `ADMIN`. `bikeId`/descripción son requeridos. `entryDate` es opcional; si
existe debe incluir `Z` u offset y máximo milisegundos; si se omite usa hora de
servidor. `assignedMechanicId` es opcional; si se envía debe identificar un
usuario activo con rol `MECANICO`.

El backend exige una motocicleta y propietario activos, y que no exista otra
orden abierta para la moto. Usa locks `Client → Bike → User → WorkOrder`, fija
`RECIBIDA`/`0.00` y crea atómicamente la orden, el history inicial y `CREATED`.
Una asignación incluida aparece en ese snapshot, sin un evento `ASSIGNED`
duplicado. Éxito 201 con Bike/Client, responsable seguro e `items: []`.
Además de errores de validación/not-found/lifecycle, puede responder
`409 BIKE_HAS_ACTIVE_WORK_ORDER`, `409 ASSIGNEE_MUST_BE_MECHANIC` o
`409 MECHANIC_INACTIVE`.

### Listar y filtrar órdenes

```http
GET /api/work-orders?status=RECIBIDA&scope=mine&page=1&pageSize=20
Authorization: Bearer <accessToken>
```

Queries opcionales:

- `status`: uno de `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`, `ENTREGADA`, `CANCELADA`;
- `plate`: igualdad exacta después de normalizar mayúsculas y espacios;
- `bikeId`: ID exacto para consultar la historia de una motocicleta;
- `clientDocumentNumber`: cédula exacta y normalizada del cliente propietario;
- `scope`: `all`, `mine` o `unassigned`;
- `assignedMechanicId`: ID exacto del mecánico responsable;
- `page`: entero positivo, default 1;
- `pageSize`: 1–100, default 20.

Para `MECANICO`, el backend usa `mine` por defecto y siempre fuerza
`assignedMechanicId` al usuario autenticado; pedir `all`, `unassigned` u otro
responsable devuelve 403. `ADMIN` usa `all` por defecto y puede consultar
`unassigned` o un responsable exacto. Combinar `scope=unassigned` con
`assignedMechanicId` es contradictorio y devuelve
`400 INVALID_ASSIGNMENT_FILTERS`.

La búsqueda de órdenes por placa no acepta semántica de subcadena: `ABC123`
encuentra esa motocicleta y `BC1` no. Esto permite resolver primero la placa
mediante `uq_bikes_plate` y evita el wildcard inicial no indexable.

Los demás filtros combinan con AND. Cada fila incluye Bike/Client y el responsable seguro,
o `assignedMechanicId: null`/`assignedMechanic: null` cuando está sin asignar;
no incluye items. Orden: `entryDate DESC, id DESC`.

```json
{
  "data": [{
    "id": 1,
    "bikeId": 1,
    "entryDate": "2026-08-24T15:00:00.000Z",
    "faultDescription": "Abnormal transmission noise",
    "status": "RECIBIDA",
    "total": "0.00",
    "assignedMechanicId": 12,
    "assignedMechanic": {
      "id": 12,
      "name": "Laura Mecánica",
      "email": "laura@example.com",
      "role": "MECANICO",
      "active": true
    },
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

Sin resultados, ambos totales son cero. Query inválida:
`400 VALIDATION_ERROR`; un scope prohibido para el actor devuelve 403.

### Detalle de orden

```http
GET /api/work-orders/:id
Authorization: Bearer <accessToken>
```

Devuelve orden, Bike/Client, responsable actual seguro, total persistido e
`items` con `id`, `type`, `description`, `count`, `unitValue`,
`createdByUserId` y el actor seguro `{ id, name }` en `createdBy`. Los ítems
legacy conservan ambos valores en `null`. Errores
400/`404 WORK_ORDER_NOT_FOUND`. `ADMIN` consulta cualquier orden;
`MECANICO` sólo una asignada actualmente a su usuario y recibe 403 ante una
orden ajena o sin responsable, con `WORK_ORDER_NOT_ASSIGNED_TO_ACTOR`.

### Asignar, reasignar o dejar sin responsable

```http
PATCH /api/work-orders/:id/assignment
Authorization: Bearer <accessToken ADMIN>
Content-Type: application/json

{ "mechanicId": 12, "reason": "Redistribución de carga" }
```

Sólo `ADMIN`. `mechanicId` acepta un ID positivo o `null`; el destino debe ser
un `MECANICO` activo y la orden debe estar abierta. `null → mechanic` puede
omitir `reason`; `mechanic A → mechanic B` y `mechanic → null` exigen una razón
no vacía de máximo 1000 caracteres. Repetir el mismo responsable se rechaza
con `400 ASSIGNMENT_UNCHANGED`.

La transacción bloquea los usuarios relevantes por ID ascendente y después la
orden. Genera exactamente uno de `ASSIGNED`, `REASSIGNED` o `UNASSIGNED`, con
before/after, IDs anterior/nuevo y razón cuando corresponde. Errores de negocio:
`404 MECHANIC_NOT_FOUND`, `409 ASSIGNEE_MUST_BE_MECHANIC`,
`409 MECHANIC_INACTIVE`, `409 WORK_ORDER_CLOSED` y
`409 CONCURRENT_MODIFICATION_RETRY`.

### Cambiar estado

```http
PATCH /api/work-orders/:id/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "toStatus": "DIAGNOSTICO", "note": "Initial diagnosis completed" }
```

`toStatus` requerido. `note` acepta string/null, se recorta y limita a 1000. El cambio, history y audit se ejecutan en una transacción con `FOR UPDATE`.

| Actual | Destinos |
|---|---|
| `RECIBIDA` | `DIAGNOSTICO`, `CANCELADA` |
| `DIAGNOSTICO` | `EN_PROCESO`, `CANCELADA` |
| `EN_PROCESO` | `DIAGNOSTICO` (regresión), `LISTA`, `CANCELADA` |
| `LISTA` | `DIAGNOSTICO` (regresión), `EN_PROCESO` (regresión), `ENTREGADA`, `CANCELADA` |
| `ENTREGADA` | ninguno |
| `CANCELADA` | ninguno |

`ADMIN` ejecuta cualquier arista válida; `MECANICO` sólo apunta a
`DIAGNOSTICO`, `EN_PROCESO`, `LISTA` y únicamente en una orden asignada a su
usuario. La propiedad se relee después del `FOR UPDATE`. Una arista inválida
para todos es 400; una válida pero prohibida o una orden ajena/sin asignar es
403.

Las tres regresiones exigen `note` no vacío; sin él responden
`400 STATUS_REGRESSION_REASON_REQUIRED`. Una regresión válida persiste la nota
en history y crea `STATUS_CHANGED` con `metadata.transitionKind=REGRESSION` y
la misma razón. `ENTREGADA → DIAGNOSTICO` continúa rechazado aquí y sólo se
ejecuta mediante la operación dedicada de reapertura.

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

Errores: `400 VALIDATION_ERROR`, `400 INVALID_STATUS_TRANSITION`,
`400 STATUS_REGRESSION_REASON_REQUIRED`,
`403 WORK_ORDER_NOT_ASSIGNED_TO_ACTOR`, `404 WORK_ORDER_NOT_FOUND`, 500 seguro.

### Reabrir por garantía o misma falla

```http
POST /api/work-orders/:id/reopen
Authorization: Bearer <accessToken ADMIN>
Content-Type: application/json

{
  "type": "WARRANTY",
  "reason": "Persiste la falla reportada por el cliente."
}
```

Operación exclusiva de `ADMIN`. `type` admite únicamente `WARRANTY` o
`SAME_ISSUE`; `reason` es obligatorio, se recorta y admite máximo 1000
caracteres. Sólo una orden actualmente `ENTREGADA`, cuya motocicleta y
propietario estén activos, puede volver a `DIAGNOSTICO`. Una falla no
relacionada debe crear una orden nueva y no existe el tipo `OTHER`.

La transacción bloquea `Client → Bike → WorkOrder`, confirma que no haya otra
orden abierta para la motocicleta, cambia el estado y escribe juntos:

- history `ENTREGADA → DIAGNOSTICO`, con actor y razón;
- audit `REOPENED`, con before/after, razón y
  `metadata.reopenType=WARRANTY|SAME_ISSUE`.

La respuesta contiene el detalle autoritativo de la orden ya reabierta. No se
agregan campos de “última reapertura”; la secuencia vive en los dos ledgers.

Errores: `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`, `403 FORBIDDEN`,
`404 WORK_ORDER_NOT_FOUND`, `409 WORK_ORDER_NOT_DELIVERED`, `409 BIKE_INACTIVE`,
`409 BIKE_OWNER_INACTIVE`, `409 BIKE_HAS_ACTIVE_WORK_ORDER` y
`409 CONCURRENT_MODIFICATION_RETRY`. Dos reaperturas o una reapertura en
competencia con alta/eliminación se serializan sin producir dos órdenes
abiertas ni trabajo operativo sobre una motocicleta eliminada.

### Consultar historial

```http
GET /api/work-orders/:id/history?page=1&pageSize=20
Authorization: Bearer <accessToken>
```

Roles: ambos. `ADMIN` consulta cualquier orden; `MECANICO` sólo el historial de
una orden asignada actualmente a su usuario. `pageSize` máximo 100. Orden
`createdAt DESC, id DESC`; actor sólo ID/nombre.

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

Errores: 400, 401, `403 WORK_ORDER_NOT_ASSIGNED_TO_ACTOR`,
`404 WORK_ORDER_NOT_FOUND`.

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

Ambos roles, pero sólo sobre órdenes abiertas. `MECANICO` únicamente agrega
sobre una orden asignada actualmente a su usuario; el service comprueba estado
y responsable bajo el lock de la orden antes de escribir. `type` es
`MANO_OBRA`/`REPUESTO`; descripción máximo 255; `count > 0`;
`unitValue >= 0`; máximo dos decimales. Number JSON o string decimal se
normaliza a string de dos decimales. `createdByUserId` proviene siempre del
usuario autenticado y cualquier valor enviado para ese campo se ignora. El
service bloquea la orden y confirma ítem, actor, audit `ITEM_ADDED` y total en
una misma transacción.

```json
{
  "data": {
    "item": {
      "id": 1,
      "type": "MANO_OBRA",
      "description": "General inspection",
      "count": "1.50",
      "unitValue": "50000.00",
      "createdByUserId": 4,
      "createdBy": { "id": 4, "name": "Mauro Mecánico" }
    },
    "workOrderTotal": "75000.00"
  }
}
```

Éxito 201; errores 400/`403 WORK_ORDER_NOT_ASSIGNED_TO_ACTOR`/
`404 WORK_ORDER_NOT_FOUND`/`409 WORK_ORDER_CLOSED`/500 seguro.

### Eliminar ítem

```http
DELETE /api/work-orders/items/:itemId
Authorization: Bearer <ADMIN accessToken>
```

Sólo `ADMIN`; `MECANICO` recibe 403 antes de validar ID. La orden debe estar
abierta. Se resuelve el padre, se bloquea la orden, se revalida el estado y
luego se bloquea/relee el ítem. Delete, audit `ITEM_DELETED` con snapshot
anterior y recálculo se confirman juntos. El último ítem deja `0.00`.

```json
{ "data": { "deletedItemId": 1, "workOrderTotal": "0.00" } }
```

Errores: 400/403/`404 WORK_ORDER_ITEM_NOT_FOUND`/`409 WORK_ORDER_CLOSED`/500
seguro. No existe endpoint PATCH/PUT de ítems: una corrección autorizada exige
eliminar y crear una fila nueva mientras la orden siga abierta.

## Códigos HTTP

| Código | Uso |
|---:|---|
| 200 | lectura, actualización, refresh o logout exitoso |
| 201 | creación exitosa |
| 400 | validación, JSON inválido o transición inválida/idempotente |
| 401 | autenticación ausente/inválida/expirada |
| 403 | rol sin permiso u origen CORS denegado |
| 404 | recurso o ruta ausente |
| 409 | conflicto de lifecycle, duplicado o estado persistido de la orden |
| 413 | JSON superior a 100 KiB |
| 429 | límite de intentos de login |
| 500 | fallo inesperado sanitizado |
