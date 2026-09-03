# Diseño congelado de productización

## Estado

- **Hito:** HITO 0 — arquitectura y congelamiento de diseño.
- **Estado de la decisión:** aprobado y congelado.
- **Fecha:** 2026-09-03.
- **Contrato rector:** `AGENTS.md` 2.4, con la corrección de orden de locks documentada en este hito.
- **Efecto actual:** ninguno sobre runtime, esquema o API. Este documento describe el destino aprobado; los documentos generales continúan describiendo el comportamiento existente hasta que cada hito lo implemente.

## 1. Objetivo de producto

La iteración convierte el MVP técnico en un producto operable de taller sin reescribir su arquitectura. La demostración crítica debe permitir:

1. encontrar o crear un cliente sin fomentar duplicados;
2. consultar y administrar sus motocicletas;
3. crear una orden sobre una motocicleta activa sin duplicar trabajo abierto;
4. asignar una única persona mecánica responsable;
5. permitir que esa persona opere solamente sus órdenes;
6. avanzar, retroceder justificadamente, entregar y reabrir por garantía;
7. reconstruir quién cambió qué, cuándo y por qué.

Inventario, facturación, pagos, citas, mensajería, portal de clientes, múltiples sedes y cambios de despliegue quedan fuera del ciclo.

## 2. Baseline verificado

La inspección se realizó sobre `main` en `2751b65`.

- Node.js/Express, React, Sequelize, Umzug y MySQL permanecen como stack.
- Existen siete migraciones originales; no se editarán.
- Clientes y motos tienen crear/listar/detalle, pero no ciclo completo.
- La relación `Client 1:N Bike` ya existe y usa FK `RESTRICT`.
- Órdenes, ítems, total exacto y ledger de estados ya son transaccionales.
- La máquina actual sólo avanza o cancela.
- `MECANICO` no tiene todavía asignación contextual y puede operar órdenes ajenas.
- No existe soft delete, auditoría empresarial global ni protección de una orden abierta por moto.
- El frontend sólo expone órdenes, nueva orden, detalle y administración de usuarios.
- MySQL ejecutado localmente reportó versión `8.4.11`.
- La base de desarrollo contenía 22 clientes, 31 motos, 97 órdenes, 194 ítems y 5 usuarios al inspeccionarse.
- El preflight detectó **20 motos con más de una orden abierta** en el volumen
  Docker de demostración. No se alteraron. El usuario confirmó que esos datos
  provienen del seeder, son descartables y la siguiente presentación partirá de
  una base limpia; por tanto, no requieren remediación manual.

El hallazgo sigue validando la necesidad de la restricción. La migración de
HITO 6 conservará el preflight y abortará ante inconsistencias en cualquier
base poblada; el reset del volumen demo se realizará sólo cuando corresponda al
flujo explícito de preparación/verificación desde cero.

## 3. Arquitectura objetivo

Se preserva el monolito modular por capas:

```text
React
  → HTTP/JSON
  → Route
  → authenticate / authorize
  → validator + allowlist
  → controller
  → service + autorización contextual + transacción
  → repository + locks + selects acotados
  → Sequelize
  → MySQL/InnoDB
```

Cambios modulares previstos:

- `clients`: lifecycle, paginación, búsqueda, riesgo de duplicado y auditoría;
- `bikes`: lifecycle, propietario, contexto de órdenes y auditoría;
- `audit`: constantes, snapshots, repositorio append-only, servicio y lectura ADMIN;
- `workOrders`: unicidad abierta, asignación, ownership, regresiones y reopen;
- `workOrderItems`: actor y protección de órdenes cerradas;
- `users`: último ADMIN y asignaciones abiertas;
- frontend: maestras, flujo reuse-first, dashboards por rol y auditoría.

Controllers permanecen como adaptadores HTTP. Ninguna decisión de dominio, lock o autorización contextual se mueve a controllers o React.

## 4. Esquema final congelado

### 4.1 `clients`

Se conservan las columnas existentes y se agregan:

| Columna | Tipo | Null | Regla |
|---|---|:---:|---|
| `deleted_at` | `DATETIME(3)` | Sí | `NULL` significa activo |
| `deleted_by_user_id` | `BIGINT UNSIGNED` | Sí | FK `users.id`, `RESTRICT` |
| `delete_reason` | `VARCHAR(1000)` | Sí | no vacío cuando está eliminado |

CHECK lógico `chk_clients_delete_state`: los tres campos están todos en `NULL`
o todos informados. La FK del actor se denomina
`fk_clients_deleted_by_user` y usa `ON DELETE RESTRICT` / `ON UPDATE RESTRICT`.
La actualización de IDs de usuario no forma parte del producto; `RESTRICT`
permite que MySQL mantenga esta columna dentro del CHECK lifecycle.

Índice inicial: `(deleted_at, name, id)` para vistas lifecycle ordenadas. La búsqueda libre por nombre/teléfono/email puede seguir usando contains en la primera entrega; HITO 15 medirá antes de añadir otra estrategia.

### 4.2 `bikes`

Se agregan las mismas tres columnas lifecycle con CHECK
`chk_bikes_delete_state` y FK `fk_bikes_deleted_by_user`, con las mismas
acciones `RESTRICT`. La placa permanece en la fila y el índice
`uq_bikes_plate` continúa siendo global, por lo cual eliminar no libera la
placa.

Índices iniciales:

- `(deleted_at, plate, id)` para vistas lifecycle;
- `(client_id, deleted_at, plate, id)` para motos paginadas de un cliente.

### 4.3 `work_orders`

HITO 1 agrega:

| Columna | Tipo | Null | Regla |
|---|---|:---:|---|
| `assigned_mechanic_id` | `BIGINT UNSIGNED` | Sí | FK `users.id`, `RESTRICT`; sólo un `MECANICO` activo puede ser asignado por servicio |

Los datos existentes quedan sin asignar. Índice: `(assigned_mechanic_id, status, entry_date DESC, id DESC)` para My Orders y Unassigned.

HITO 6 agrega, después de un preflight sin violaciones:

```sql
open_bike_id BIGINT UNSIGNED
  GENERATED ALWAYS AS (
    CASE
      WHEN status IN ('RECIBIDA', 'DIAGNOSTICO', 'EN_PROCESO', 'LISTA')
      THEN bike_id
      ELSE NULL
    END
  ) STORED
```

`UNIQUE uq_work_orders_open_bike (open_bike_id)` permite muchas órdenes cerradas porque MySQL admite múltiples `NULL`, pero sólo una fila abierta por `bike_id`. Es una columna interna: no se acepta ni se serializa.

La estrategia es compatible con MySQL 8.4: las columnas generadas stored se pueden indexar y los índices únicos sobre columnas nullable admiten múltiples `NULL` ([manual de CREATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/create-table.html), [manual de CREATE INDEX](https://dev.mysql.com/doc/refman/8.4/en/create-index.html)). Sequelize 6 permite que una migración ejecute SQL fijo mediante `sequelize.query` cuando QueryInterface no expresa una característica específica del dialecto ([Sequelize v6, raw queries](https://sequelize.org/docs/v6/core-concepts/raw-queries/)).

La migración usará SQL fijo sin entrada externa y limpieza explícita si falla una DDL posterior, porque MySQL hace autocommit de varias operaciones DDL.

### 4.4 `work_order_items`

Se agrega `created_by_user_id BIGINT UNSIGNED NULL`, FK a `users.id` con `RESTRICT`.

- `NULL` identifica filas legacy o creadas antes de activar HITO 12;
- desde HITO 12 toda creación API exige actor autenticado;
- no se crea endpoint de update de ítems;
- no se añade índice funcional aparte del requerido por la FK porque no existe consulta primaria por creador.

### 4.5 `audit_events`

```text
id                  BIGINT UNSIGNED PK AUTO_INCREMENT
entity_type         ENUM contractual NOT NULL
entity_id           BIGINT UNSIGNED NOT NULL
action              ENUM contractual NOT NULL
actor_user_id       BIGINT UNSIGNED NOT NULL FK users.id RESTRICT
before_data         JSON NULL
after_data          JSON NULL
metadata            JSON NULL
reason              VARCHAR(1000) NULL
created_at          DATETIME(3) NOT NULL
```

No tiene `updated_at`, soft delete ni FK polimórfica sobre `entity_id`. Índices:

- `(created_at DESC, id DESC)` para listado global;
- `(entity_type, entity_id, created_at DESC, id DESC)` para timeline de entidad;
- `(actor_user_id, created_at DESC, id DESC)` para filtro por actor;
- `(action, created_at DESC, id DESC)` para filtro por acción.

La tabla sólo se escribe mediante `auditRepository.create`. No existirán métodos o endpoints de update/delete.

Catálogo contractual inicial:

```text
entity_type:
CLIENT | BIKE | WORK_ORDER | WORK_ORDER_ITEM | USER

action:
CREATED | UPDATED | SOFT_DELETED | RESTORED | OWNER_CHANGED
ASSIGNED | REASSIGNED | UNASSIGNED | STATUS_CHANGED | REOPENED
CANCELLED | ITEM_ADDED | ITEM_DELETED | ROLE_CHANGED | ACTIVATED
DEACTIVATED
```

## 5. Lifecycle de maestras

### 5.1 Clientes

Normalización:

- nombre: trim, sin unicidad;
- email: trim + lowercase, opcional y validado;
- teléfono: trim, retirar espacios, guiones, puntos y paréntesis, preservar como máximo un `+` inicial, validar `^\+?\d{7,20}$` y almacenar canónico;
- no se infiere código de país.

Riesgo de duplicado:

1. create y cambios de teléfono/email buscan coincidencias exactas normalizadas, excluyendo el propio ID en update;
2. coincidencia activa: `409 CLIENT_DUPLICATE_RISK` con `candidateIds` y `matchedFields` seguros;
3. la UI ofrece reutilizar el registro;
4. si son personas distintas, `confirmDuplicate: true` y `duplicateReason` no vacío autorizan la operación y quedan en audit;
5. coincidencia eliminada: `409 CLIENT_RESTORE_REQUIRED`; debe restaurarse, sin override;
6. restore vuelve a evaluar coincidencias activas; ante riesgo responde el mismo
   `409 CLIENT_DUPLICATE_RISK` y sólo continúa con `confirmDuplicate: true` más
   `duplicateReason`;
7. teléfono/email no son UNIQUE porque contactos compartidos son válidos;
8. esta política reduce riesgo, pero no pretende ser una invariancia concurrente de identidad.

Un cliente eliminado es de solo lectura para ADMIN hasta restaurarlo. PATCH
responde `409 CLIENT_INACTIVE`.

Eliminar:

- sólo ADMIN;
- `reason` obligatorio;
- lock del cliente y sus motos activas;
- con una moto activa: `409 CLIENT_HAS_ACTIVE_BIKES`;
- nunca cascada;
- ya eliminado: `409 CLIENT_ALREADY_DELETED`.

Restaurar:

- sólo ADMIN y reason obligatorio;
- ya activo: `409 CLIENT_NOT_DELETED`;
- limpia los tres campos lifecycle;
- no restaura motos automáticamente.

### 5.2 Motocicletas

- placa exacta normalizada conserva unicidad global;
- create con placa activa: `409 BIKE_PLATE_ALREADY_EXISTS`;
- create con placa eliminada: `409 BIKE_RESTORE_REQUIRED`;
- edición general no cambia propietario;
- owner change usa endpoint dedicado, cliente destino activo y reason obligatorio;
- el cambio de propietario nunca reescribe órdenes históricas.

Una moto eliminada es de solo lectura para ADMIN hasta restaurarla. PATCH y
owner change responden `409 BIKE_INACTIVE`. Una moto activa sólo puede cambiar
a un propietario activo.

Eliminar:

- ADMIN y reason obligatorio;
- moto ya eliminada: `409 BIKE_ALREADY_DELETED`;
- si tiene orden abierta: `409 BIKE_HAS_ACTIVE_WORK_ORDER`;
- no elimina órdenes o ítems.

Restaurar:

- ADMIN y reason obligatorio;
- moto ya activa: `409 BIKE_NOT_DELETED`;
- propietario eliminado: `409 BIKE_OWNER_INACTIVE`;
- conserva placa y propietario.

## 6. Auditoría congelada

### 6.1 Entidades y snapshots permitidos

Los snapshots usan claves de dominio en camelCase, IDs como strings para no perder precisión, fechas ISO 8601 y decimales como strings.

| Entidad | Campos permitidos en before/after |
|---|---|
| `CLIENT` | `id`, `name`, `phone`, `email`, `deletedAt`, `deletedByUserId`, `deleteReason` |
| `BIKE` | `id`, `plate`, `brand`, `model`, `cylinder`, `clientId`, `deletedAt`, `deletedByUserId`, `deleteReason` |
| `WORK_ORDER` | `id`, `bikeId`, `entryDate`, `faultDescription`, `status`, `total`, `assignedMechanicId` |
| `WORK_ORDER_ITEM` | `id`, `workOrderId`, `type`, `description`, `count`, `unitValue`, `createdByUserId` |
| `USER` | `id`, `name`, `email`, `role`, `active` |

Nunca se permite agregar por spread un modelo completo. Cada snapshot se construye campo por campo. Password, hash, access/refresh token, cookies, secretos, env y datos internos de sesión quedan prohibidos.

### 6.2 Dirección de snapshots

| Acción | `beforeData` | `afterData` |
|---|---|---|
| `CREATED`, `ITEM_ADDED` | `null` | snapshot nuevo |
| `ITEM_DELETED` | snapshot previo | `null` |
| demás mutaciones | snapshot previo | snapshot posterior |

Un intento fallido o sin permiso no genera evento. Dominio y evento hacen commit o rollback juntos. Una mutación produce una sola acción, la más específica.

### 6.3 Activación por hito

| Hito | Mutaciones que empiezan a auditarse |
|---:|---|
| 2 | altas autenticadas de cliente, moto, usuario y orden; alta de ítem; transiciones forward/cancel del runtime existente; lectura ADMIN del audit |
| 3 | update/delete/restore y override de cliente |
| 4 | update/delete/restore/owner change de moto |
| 7 | assign/reassign/unassign |
| 10 | regresiones genéricas mediante `STATUS_CHANGED` |
| 11 | `REOPENED` |
| 12 | delete de ítem y atribución persistida de su creador |
| 13 | role/active de usuarios con reglas endurecidas |

Migraciones, seeds y la creación bootstrap previa a disponer de un actor
autenticado no inventan `actor_user_id` ni generan eventos empresariales. Su
trazabilidad vive en migraciones, seed scripts y logs de despliegue. Toda
mutación de producto posterior exige actor autenticado.

### 6.4 Metadata permitida

| Acción | Metadata exacta |
|---|---|
| `CREATED` de CLIENT con override | `duplicateOverride`, `matchedFields`, `candidateIds` |
| `UPDATED` | `changedFields`; para CLIENT puede añadir los tres campos de duplicate override |
| `RESTORED` de CLIENT con override | `duplicateOverride`, `matchedFields`, `candidateIds`, `duplicateReason` |
| `OWNER_CHANGED` | `previousClientId`, `newClientId` |
| `ASSIGNED`, `REASSIGNED`, `UNASSIGNED` | `previousMechanicId`, `newMechanicId` |
| `STATUS_CHANGED` | `transitionKind: FORWARD | REGRESSION` |
| `REOPENED` | `reopenType: WARRANTY | SAME_ISSUE` |
| `ROLE_CHANGED` | `previousRole`, `newRole` |
| `ACTIVATED`, `DEACTIVATED` | `previousActive`, `newActive` |
| restantes | `null` |

Arrays se ordenan de forma determinista. Campos no listados se descartan, no se persisten.

### 6.5 Razón obligatoria

Reason se recorta, no puede quedar vacío y admite máximo 1000 caracteres para:

- duplicate override de cliente;
- `SOFT_DELETED` y `RESTORED`;
- `OWNER_CHANGED`;
- `REASSIGNED` y `UNASSIGNED`;
- regresiones de estado;
- `CANCELLED`;
- `REOPENED`;
- `ROLE_CHANGED`, `ACTIVATED` y `DEACTIVATED`.

Primera asignación `null → mechanic` y avance normal pueden omitir reason. En el endpoint de estado, `note` cumple el papel de reason cuando es obligatorio y se copia al evento.

## 7. Máquina de estados y responsabilidad

### 7.1 Matriz final

| Desde | Hacia | Operación | Reason | ADMIN | MECANICO asignado |
|---|---|---|:---:|:---:|:---:|
| `RECIBIDA` | `DIAGNOSTICO` | status PATCH | opcional | Sí | Sí |
| `RECIBIDA` | `CANCELADA` | status PATCH | obligatorio | Sí | No |
| `DIAGNOSTICO` | `EN_PROCESO` | status PATCH | opcional | Sí | Sí |
| `DIAGNOSTICO` | `CANCELADA` | status PATCH | obligatorio | Sí | No |
| `EN_PROCESO` | `LISTA` | status PATCH | opcional | Sí | Sí |
| `EN_PROCESO` | `DIAGNOSTICO` | status PATCH | obligatorio | Sí | Sí |
| `EN_PROCESO` | `CANCELADA` | status PATCH | obligatorio | Sí | No |
| `LISTA` | `ENTREGADA` | status PATCH | opcional | Sí | No |
| `LISTA` | `DIAGNOSTICO` | status PATCH | obligatorio | Sí | Sí |
| `LISTA` | `EN_PROCESO` | status PATCH | obligatorio | Sí | Sí |
| `LISTA` | `CANCELADA` | status PATCH | obligatorio | Sí | No |
| `ENTREGADA` | `DIAGNOSTICO` | sólo reopen | obligatorio + type | Sí | No |
| `CANCELADA` | cualquiera | ninguna | — | No | No |

Mismo estado es `400 INVALID_STATUS_TRANSITION`. Cualquier arista no listada es inválida. Un mecánico sin asignación o asignado a otra orden recibe `403 WORK_ORDER_NOT_ASSIGNED_TO_ACTOR` antes de mutar.

### 7.2 Reopen

`POST /api/work-orders/:id/reopen` no comparte validator ni service entry point con status PATCH.

Requiere:

- ADMIN;
- orden `ENTREGADA`;
- moto y cliente activos;
- `type` en `WARRANTY | SAME_ISSUE`;
- reason obligatorio;
- ninguna otra orden abierta para la moto.

Actualiza a `DIAGNOSTICO`, inserta history `ENTREGADA → DIAGNOSTICO`, crea audit `REOPENED` con `metadata.reopenType` y hace commit atómico. Una falla diferente crea otra orden cuando no exista una abierta.

No se agregan campos de última reapertura a `work_orders`: múltiples reaperturas se reconstruyen desde ledgers append-only.

### 7.3 Asignación

- una FK escalar representa cero o un mecánico responsable;
- sólo ADMIN crea órdenes y cambia asignación;
- `POST /api/work-orders` acepta `assignedMechanicId` opcional;
- un assignee debe existir, estar activo y tener rol `MECANICO`;
- orden abierta puede asignarse, reasignarse o volver a unassigned;
- orden cerrada rechaza cambios con `409 WORK_ORDER_CLOSED`;
- null → mechanic: `ASSIGNED`, reason opcional;
- mechanic A → mechanic B: `REASSIGNED`, reason obligatorio;
- mechanic → null: `UNASSIGNED`, reason obligatorio;
- asignación incluida al crear aparece sólo en snapshot `CREATED`.

## 8. Ítems y usuarios

### Ítems

- sólo una orden abierta admite add/delete;
- ADMIN puede agregar/eliminar en cualquier orden abierta;
- MECANICO puede agregar únicamente en su orden asignada abierta;
- MECANICO no elimina;
- reopen vuelve a habilitar add/delete según permisos;
- no existe update; corregir implica delete ADMIN + nueva fila mientras esté abierta;
- item, actor, audit y total exacto se confirman en la misma transacción bajo lock de orden.

### Usuarios

- no desactivar ni quitar rol a un mecánico con órdenes abiertas asignadas: `409 MECHANIC_HAS_OPEN_ORDERS`;
- no desactivar ni cambiar de rol al último ADMIN activo: `409 LAST_ACTIVE_ADMIN_REQUIRED`;
- toda operación que pueda reducir ADMIN activos bloquea, en orden de id, todas
  las filas que eran ADMIN activas al iniciar su sección crítica y vuelve a
  contar bajo lock; así dos administradores no pueden retirarse simultáneamente
  dejando el sistema sin ADMIN;
- asignaciones deben resolverse primero;
- role/active update exige reason;
- usuario, asignaciones relevantes y audit se validan/escriben bajo transacción;
- sesiones existentes continúan invalidándose inmediatamente mediante la recarga actual de usuario.

## 9. Orden de locks congelado

Cuando una operación necesita varias entidades, adquiere sólo los niveles relevantes y nunca los invierte:

```text
Client(s), por id ascendente
→ Bike
→ User(s), por id ascendente
→ WorkOrder
→ WorkOrderItem
```

Una lectura preliminar puede descubrir IDs, pero no autoriza la mutación. Después de adquirir locks se relee todo estado mutable.

| Operación | Locks y revalidación |
|---|---|
| Delete client | Client → sus Bikes activas; revalidar lifecycle y existencia de motos |
| Create bike | Client; revalidar activo antes de insert |
| Update owner | preleer Bike; Client origen/destino ordenados → Bike; revalidar owner y lifecycle |
| Delete/restore bike | preleer owner; Client → Bike → orden abierta si aplica |
| Create order | preleer Bike/owner; Client → Bike → User destino opcional; revalidar lifecycle/rol y consultar `open_bike_id` |
| Transición open→open | WorkOrder; revalidar status/ownership |
| Transición open→closed | preleer Bike; Bike → WorkOrder; revalidar status/ownership |
| Reopen | preleer Bike/owner; Client → Bike → WorkOrder; revalidar lifecycle/status y ausencia de competidor |
| Assign/reassign | preleer orden/usuarios; User IDs ordenados → WorkOrder; revalidar rol/activo/status |
| Role/active user | si reduce ADMIN, todos los ADMIN activos por id; además target User → WorkOrders abiertas asignadas; revalidar último ADMIN/asignaciones |
| Add item | WorkOrder; revalidar abierto/ownership, insertar, sumar y auditar |
| Delete item | preleer parent; WorkOrder → WorkOrderItem; revalidar abierto/existencia, borrar, sumar y auditar |

La creación no empieza con el lock de Bike si también necesita validar el cliente: primero prelee la relación y después bloquea Client → Bike. Esta regla corrige la ambigüedad del contrato anterior.

Una violación de unique conocida se traduce al conflict específico. Deadlock o lock timeout reconocido se traduce a `409 CONCURRENT_MODIFICATION_RETRY`; no se reintenta silenciosamente una mutación compleja.

## 10. API final

### 10.1 Convenciones

- recurso: `{ "data": {} }`;
- colección: `{ "data": [], "meta": { "page", "pageSize", "totalItems", "totalPages" } }`;
- error: `{ "error": { "code", "message", "details?" } }`;
- page default 1, pageSize default 20, máximo 100;
- IDs positivos; fechas ISO 8601; orden estable con `id` como desempate;
- campos desconocidos nunca llegan al repository;
- 401 antes de validar negocio; 403 para actor autenticado sin permiso; 404 ausente; 409 conflicto con estado persistido.

### 10.2 Endpoints

| Método y ruta | Rol | Entrada principal | Resultado/notas |
|---|---|---|---|
| `POST /api/clients` | ADMIN | name, phone, email?, confirmDuplicate?, duplicateReason? | 201; riesgo 409 |
| `GET /api/clients` | ambos | search, lifecycle, page, pageSize | mechanic sólo active |
| `GET /api/clients/:id` | ambos | id | deleted sólo ADMIN; UI combina motos paginadas |
| `PATCH /api/clients/:id` | ADMIN | al menos uno de name/phone/email; override si aplica | 200 |
| `DELETE /api/clients/:id` | ADMIN | reason | 200 soft-deleted |
| `POST /api/clients/:id/restore` | ADMIN | reason, confirmDuplicate?, duplicateReason? | 200 active; riesgo 409 |
| `POST /api/bikes` | ADMIN | plate, brand, model, cylinder?, clientId | 201 |
| `GET /api/bikes` | ambos | plate, platePrefix, clientId, lifecycle, page, pageSize | filtros de placa excluyentes; mechanic active |
| `GET /api/bikes/:id` | ambos | id | currentOpenOrder summary; deleted sólo ADMIN |
| `PATCH /api/bikes/:id` | ADMIN | plate/brand/model/cylinder, al menos uno | no owner |
| `PATCH /api/bikes/:id/owner` | ADMIN | clientId, reason | 200 + OWNER_CHANGED |
| `DELETE /api/bikes/:id` | ADMIN | reason | 200 soft-deleted |
| `POST /api/bikes/:id/restore` | ADMIN | reason | 200 active |
| `POST /api/work-orders` | ADMIN | bikeId, faultDescription, entryDate?, assignedMechanicId? | 201 atómico |
| `GET /api/work-orders` | ambos | status, plate, bikeId, scope, assignedMechanicId, page, pageSize | defaults por rol |
| `GET /api/work-orders/:id` | ADMIN/owner | id | detalle + assignee |
| `PATCH /api/work-orders/:id/assignment` | ADMIN | mechanicId nullable, reason condicional | sólo abierta |
| `PATCH /api/work-orders/:id/status` | ADMIN/owner | toStatus, note? | matriz genérica |
| `POST /api/work-orders/:id/reopen` | ADMIN | type, reason | ENTREGADA → DIAGNOSTICO |
| `GET /api/work-orders/:id/history` | ADMIN/owner | page, pageSize | newest-first |
| `POST /api/work-orders/:id/items` | ADMIN/owner | type, description, count, unitValue | sólo abierta |
| `DELETE /api/work-orders/items/:itemId` | ADMIN | itemId | sólo abierta |
| `GET /api/audit-events` | ADMIN | entityType, entityId, action, actorUserId, dateFrom, dateTo, page, pageSize | newest-first |
| `GET /api/audit-events/:id` | ADMIN | id | snapshot seguro |
| `PATCH /api/users/:id/role` | ADMIN | role, reason | invariantes de usuario |
| `PATCH /api/users/:id/active` | ADMIN | active, reason | invariantes de usuario |

Registro/listado de usuarios y endpoints auth actuales se preservan. HITO 13 añade reason al cambio de rol/activo; no cambia arquitectura JWT.

En motos, `plate` hace igualdad normalizada y es la consulta primaria de los
flujos operativos. `platePrefix` hace búsqueda normalizada por prefijo para la
maestra administrativa. No se permite `LIKE '%valor%'`; enviar ambos filtros
de placa produce `400 INVALID_QUERY_FILTERS`.

### 10.3 Filtros de órdenes por rol

- `scope=all|mine|unassigned`;
- ADMIN default `all` y puede combinar assignee/status;
- MECANICO default/único `mine`; pedir `all`, `unassigned` u otro assignee devuelve 403;
- `bikeId` soporta historia paginada desde detalle de moto;
- el servicio impone ownership aunque el frontend o query sean manipulados.

La vista de cliente combina `GET client` + `GET bikes?clientId=...`; la vista de moto combina `GET bike` + `GET work-orders?bikeId=...`. No se incluyen arrays históricos sin límite dentro de un detail.

## 11. Rutas y páginas frontend

| Ruta | Rol | Página/objetivo |
|---|---|---|
| `/dashboard` | ambos | resumen operativo según rol |
| `/orders` | ambos | all para ADMIN, mine para MECANICO |
| `/orders/new` | ADMIN | cliente → moto → orden → assignee opcional |
| `/orders/:id` | ADMIN/owner | detalle, items, estado, history, assignment ADMIN |
| `/clients` | ambos | active; lifecycle ADMIN |
| `/clients/new` | ADMIN | alta y resolución de duplicados |
| `/clients/:id` | ambos | datos + motos paginadas |
| `/clients/:id/edit` | ADMIN | edición |
| `/bikes` | ambos | búsqueda/listado; lifecycle ADMIN |
| `/bikes/new` | ADMIN | alta, acepta clientId preseleccionado |
| `/bikes/:id` | ambos | owner, orden abierta e historia paginada |
| `/bikes/:id/edit` | ADMIN | edición y owner change separado |
| `/admin/users` | ADMIN | lifecycle endurecido |
| `/admin/audit` | ADMIN | filtros y paginación |
| `/admin/audit/:id` | ADMIN | evento seguro |

El index autenticado redirige a `/dashboard`. Navegación MECANICO muestra Dashboard, My Orders, Clients y Motorcycles en modo lectura. No muestra creación, lifecycle, users o audit.

Todas las mutaciones bloquean doble submit, muestran error seguro, tienen feedback de éxito y refrescan desde backend. Delete/restore, owner change, reassignment, regresión, cancelación y reopen requieren confirmación que capture reason.

## 12. Orden exacto de migraciones

Los nombres y el orden quedan fijados así:

| Orden | Hito | Migración | Efecto |
|---:|---:|---|---|
| 008 | 1 | `202609030008-add-master-data-lifecycle.js` | campos/checks/FKs/índices de clients y bikes |
| 009 | 1 | `202609030009-create-audit-events.js` | tabla append-only e índices |
| 010 | 1 | `202609030010-add-work-order-assignment.js` | FK nullable e índice |
| 011 | 1 | `202609030011-add-work-order-item-creator.js` | FK nullable legacy |
| 012 | 3 | `202609030012-normalize-client-contacts.js` | preflight + canonicalización data-only |
| 013 | 6 | `202609030013-enforce-single-open-order.js` | preflight + generated column + UNIQUE |

Reglas:

- no editar 001–007;
- cada up limpia artefactos parciales si una DDL posterior falla;
- down quita dependencias en orden inverso;
- la canonicalización 012 es idempotente pero no recupera puntuación visual eliminada; su down documenta esta irreversibilidad semánticamente segura y no inventa datos;
- 013 hace preflight antes de DDL y aborta mostrando sólo `bike_id` y cantidad, nunca cambia status;
- fresh DB, DB poblada, rollback/reapply y demo seed forman parte de sus tests.

## 13. Estrategia de pruebas

### Capas

- validadores: allowlists, normalización, razones condicionales y límites;
- servicios/repositorios: reglas, locks, snapshots y rollback;
- integración MySQL: FKs, CHECK, índices, JSON, generated column y carreras reales;
- frontend: loading/error/empty/retry, roles, confirmaciones y payloads;
- aceptación: recorridos ADMIN y MECANICO completos.

### Carreras obligatorias

1. dos creates de orden para la misma moto: uno 201, otro 409;
2. create contra close/reopen: resultado serializable, nunca dos abiertas;
3. dos reopens: máximo uno;
4. reassign concurrente: before/after lineal y audit correcto;
5. assign contra deactivate/role change: nunca queda asignado un usuario inválido;
6. delete bike contra create/reopen: o delete válido o conflicto, nunca recurso eliminado operativo;
7. delete client contra create/owner change de bike: nunca cliente eliminado con moto activa;
8. add/delete item contra close/reopen: total exacto y reglas de abierto preservadas.
9. dos ADMIN activos se desactivan/cambian de rol a la vez: al menos uno queda
   activo y la otra operación recibe `409 LAST_ACTIVE_ADMIN_REQUIRED`.

### Regresión mínima por hito

- Hitos backend: `npm test`, `npm run lint`, `npm run db:migrate:status`;
- hitos frontend: `npm test`, `npm run lint`, `npm run build`;
- migraciones: clean up/down/reapply y DB poblada;
- final: ambos paquetes, seeds, Postman, manual responsive/keyboard y matriz documentada.

No se deshabilitan pruebas viejas. Las expectativas que cambien por una evolución intencional de producto se actualizan junto con casos nuevos que demuestren la nueva regla.

## 14. Dependencias del roadmap

```text
H0 diseño
  → H1 persistencia
  → H2 auditoría
  → H3 clientes backend
  → H4 motos backend
  → H5 maestras UI
  → H6 una abierta
  → H7 asignación backend
  → H8 nueva orden UI
  → H9 ownership/My Orders
  → H10 regresiones
  → H11 reopen
  → H12 ítems
  → H13 usuarios
  → H14 dashboard/audit UI
  → H15 performance
  → H16 seguridad
  → H17 UX E2E
  → H18 aceptación
  → H19 docs/Postman
  → H20 release
```

La nueva orden se implementa después de unicidad abierta y asignación para que nunca dependa de autoridad frontend.

## 15. Decisiones cerradas

- soft delete explícito, no paranoid;
- clientes con motos activas no se eliminan;
- placa globalmente única y reservada durante soft delete;
- duplicate-risk de cliente permite override activo justificado, nunca duplica uno eliminado;
- auditoría global y status history coexisten;
- snapshots y metadata usan allowlists cerradas;
- una orden abierta se protege con lock de moto + generated UNIQUE;
- una orden admite cero o un mecánico; sólo un MECANICO activo;
- ADMIN crea órdenes y muta maestras; MECANICO opera sólo las propias;
- tres regresiones genéricas con reason;
- ENTREGADA → DIAGNOSTICO sólo por reopen WARRANTY/SAME_ISSUE;
- CANCELADA permanece terminal;
- no update de ítems;
- no se desactiva último ADMIN ni mecánico con trabajo abierto;
- detalles históricos se componen con endpoints paginados, no includes ilimitados;
- ninguna inconsistencia legacy se corrige automáticamente.

## 16. Gate de HITO 0

- [x] baseline y gaps inspeccionados;
- [x] esquema y orden de migración definidos;
- [x] soft delete y duplicados definidos;
- [x] auditoría y allowlists definidas;
- [x] matriz de estados definida;
- [x] estrategia de una orden abierta validada para MySQL 8.4;
- [x] locks y revalidaciones definidos;
- [x] assignment/ownership definidos;
- [x] reopen e ítems definidos;
- [x] invariantes de usuario definidos;
- [x] API y rutas frontend definidas;
- [x] estrategia de pruebas definida;
- [x] alcance y dependencias cerrados;
- [x] baseline automatizado ejecutado al cierre del hito: backend 199/199,
  frontend 46/46, ambos lint, build y estado de migraciones sin fallos.
