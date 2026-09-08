# Arquitectura

## Estado y alcance

Este documento describe la arquitectura del producto vigente, consolidado en
HITO 19 y extendido con identificación única de clientes después de HITO 20:
conserva las fases 1 y 2 y añade maestras completas, auditoría global, una sola
orden abierta por motocicleta, responsabilidad mecánica, retornos controlados,
reapertura, lifecycle seguro de usuarios, dashboard operativo y UX endurecida.

## Estilo arquitectónico

PAVAS Moto Workshop usa un **monolito modular por capas**. El dominio del taller
es cohesivo y requiere transacciones directas sobre una única base relacional.
Las siete entidades originales se preservan; HITO 1 añadió `AuditEvent` como
fundación persistente, HITO 2 activó la auditoría, HITO 3 completó clientes y
HITO 4 completó motocicletas, HITO 6 protegió la unicidad de la orden abierta y
HITO 7 activó la asignación, HITO 8 conectó esas capacidades en el flujo
frontend cliente → motocicleta → orden y HITO 9 hizo efectiva la responsabilidad
individual del mecánico. HITO 10 añadió tres regresiones operativas explícitas,
con razón obligatoria y doble ledger. HITO 11 añadió la reapertura administrativa
de garantía/misma falla como operación dedicada y transaccional. HITO 12 activó
atribución y protección de lifecycle para los ítems. HITO 13 protegió el último
administrador y los mecánicos con trabajo abierto; HITO 14 incorporó el
dashboard por rol; HITO 15 alineó consultas e índices; HITO 16 auditó las
fronteras de seguridad y HITO 17 cerró recuperación de sesión, teclado,
responsive y conflictos de extremo a extremo. HITO 18 consolidó la evidencia
de aceptación y regresión. Una sola API Express permite
conservar límites claros sin introducir costes operativos que la prueba no
necesita.

Los microservicios añadirían red, despliegues, observabilidad y consistencia distribuida sin resolver un requisito. Los módulos internos conservan responsabilidades explícitas y pueden evolucionar sin convertir la aplicación en un bloque de CRUD sin estructura.

## Flujo de una petición backend

```text
Petición HTTP
     ↓
Helmet
     ↓
CORS con origen exacto y credenciales
     ↓
Parser JSON limitado a 100 KiB
     ↓
Route
     ↓
Authentication
     ↓
Authorization cuando aplica
     ↓
Validation middleware
     ↓
Controller
     ↓
Service
     ↓
Repository
     ↓
Sequelize
     ↓
MySQL
```

En rutas protegidas, autenticación y autorización se ejecutan antes de exponer detalles de validación. Health, login, refresh y logout son públicos; `/me` exige autenticación. La autorización de destinos de estado se completa dentro del servicio y de la transacción bloqueada.

## Responsabilidades del backend

### Routes

Mapean método y URL, conectan middlewares y delegan en controllers. No contienen reglas de negocio.

### Controllers

Extraen la entrada ya validada, llaman un service y asignan la respuesta HTTP. No mutan modelos, calculan totales ni deciden transiciones.

### Services

Son dueños de reglas de negocio, autorización de dominio, transacciones y operaciones con varias escrituras. Estados, auditoría y totales tienen una única implementación autoritativa.

### Repositories

Concentran consultas reutilizables, filtros, includes, paginación y bloqueos de fila. Los grafos complejos no se construyen en controllers.

### Models

Representan esquema, asociaciones, validaciones de persistencia y serialización segura. No conocen HTTP.

### Validators

Validan cuerpos, queries y parámetros externos antes de ejecutar servicios. Las restricciones de MySQL siguen siendo la barrera final.

### Middlewares y errores

Centralizan autenticación, roles, rate limiting, 404 y manejo de errores. Las clases `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError` y `BusinessRuleError` transportan códigos públicos seguros; un único error middleware evita filtrar SQL, JWT, paths o stacks.

## Transacciones y concurrencia

Las operaciones con varias escrituras son atómicas:

- **Altas de maestras/usuarios:** cliente, motocicleta o usuario y su evento `CREATED` se confirman o revierten juntos.
- **Lifecycle de clientes:** update, soft delete y restore bloquean el cliente; delete bloquea además sus motos activas en orden canónico. Estado y evento global confirman o revierten juntos. Crear una moto toma primero el lock del cliente para serializarse contra delete.
- **Lifecycle de motocicletas:** update bloquea la moto; owner change bloquea clientes origen/destino por ID y luego la moto; delete/restore bloquean propietario y moto antes de revalidar lifecycle. Delete también bloquea las órdenes abiertas y toda mutación confirma o revierte junto con su audit.
- **Ítems y total:** el service bloquea `WorkOrder`, revalida que esté abierto y, para `MECANICO`, su asignación. Add persiste el actor autenticado; delete `ADMIN` bloquea después el `WorkOrderItem`. Ítem, audit `ITEM_ADDED`/`ITEM_DELETED` y total recalculado con `SUM(count * unit_value)` confirman o revierten juntos. El lock de orden serializa add/add, add/delete y las carreras con close/reopen.
- **Creación de orden:** bloquea propietario, motocicleta y responsable opcional en orden canónico; rechaza recursos eliminados, assignee inválido u otra orden abierta. Orden `RECIBIDA`, history inicial y `CREATED` se confirman o revierten juntos; un generated UNIQUE es la barrera final de una abierta por moto.
- **Asignación:** bloquea los usuarios anterior/destino por ID y después la orden; revalida status y asignación persistida antes de escribir `ASSIGNED`, `REASSIGNED` o `UNASSIGNED` dentro de la misma transacción.
- **Ownership operativo:** listas, detalle e historial restringen al `MECANICO` a su ID autenticado. Estado e ítems verifican de nuevo el responsable persistido después de bloquear la orden, por lo que una reasignación revoca acceso operativo inmediatamente.
- **Cambio de estado:** el service bloquea la orden, relee el estado persistido, valida grafo y actor, clasifica la arista como `FORWARD` o `REGRESSION` y exige razón para toda regresión. La actualización, una fila de history y un evento global se confirman o revierten juntos. Un competidor espera y valida contra el resultado confirmado.
- **Reapertura:** el service bloquea `Client → Bike → WorkOrder`, exige recursos activos, estado `ENTREGADA` y ausencia de otra orden abierta. El paso a `DIAGNOSTICO`, history y audit `REOPENED` con tipo/razón son atómicos; los mismos locks serializan reapertura contra otra reapertura, alta de orden y eliminación de motocicleta.
- **Lifecycle de usuarios:** role/active exige razón. La reducción de un ADMIN
  bloquea el conjunto de administradores activos; la mutación de un mecánico
  coordina su fila con sus órdenes abiertas. Revalidación y audit ocurren en una
  transacción, evitando perder el último ADMIN u orfanar trabajo.
- **Refresh:** la fila del token presentado se bloquea durante rotación. Una segunda utilización concurrente se interpreta defensivamente como replay.

El total se calcula con operandos `DECIMAL` y viaja como string; no se usa `Number` para dinero. Consulte [ADR-004](decisions/ADR-004-server-side-order-total.md).

Los historiales se consultan con límite/offset acotado, un join del actor que selecciona sólo ID/nombre y orden `created_at DESC, id DESC`. El audit global admite filtros cerrados por entidad, identidad, acción, actor y rango de fechas, únicamente para `ADMIN`.

## Persistencia y migraciones

MySQL 8/InnoDB es la fuente de verdad y Sequelize el mapper/query layer. Umzug
ejecuta quince migraciones ESM y registra su estado en `SequelizeMeta`. Las cuatro
migraciones de HITO 1 añaden fundamentos compatibles con filas legacy; la 012
prevalida y canonicaliza contactos de clientes sin inventar datos; la 013
instala la barrera de orden abierta, la 014 añade índices medidos para colas e
historia operativa y la 015 incorpora la cédula única de cliente sin inventar
valores para filas legacy. No se usa
`sequelize.sync` como estrategia de esquema.

Desarrollo usa `pavas_workshop`; integración usa `pavas_workshop_test` y una guarda rechaza objetivos inseguros. Consulte [Base de datos](database.md) y [Pruebas](testing.md).

## Arquitectura frontend

La aplicación React usa Vite y módulos orientados a funcionalidad:

```text
App / routes
     ↓
Layouts y pages
     ↓
Feature components y hooks
     ↓
API clients
     ↓
Express API
```

```text
src/
├── api/                    clientes Axios y módulos de recursos
├── components/ui/          estados compartidos de carga, error y vacío
├── constants/              labels y mapa visual de transiciones
├── context/ y hooks/       AuthContext y acceso acotado
├── features/auth/          coordinador de sesión en memoria
├── features/workOrders/    órdenes, permisos e historial
├── layouts/                shell de aplicación
├── pages/                  orquestación por ruta
├── routes/                 rutas y guardas de sesión/rol
└── utils/                  errores seguros y formato decimal
```

Los datos de servidor viven cerca de la pantalla que los consume. `AuthContext` se limita a sesión; los formularios usan estado local; Redux no es necesario.

`/dashboard` es el inicio autenticado. Consulta las cuatro colas abiertas reales
(`RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`) con scope `all` para
`ADMIN` y `mine` para `MECANICO`; cada tarjeta abre `/orders` con esos filtros
en la URL. `ADMIN` dispone además de accesos directos a todas las órdenes, la
cola sin asignar y la creación. El dashboard no calcula métricas derivadas ni
simula reglas de negocio en cliente.

`/admin/audit` y `/admin/audit/:id` consumen la lectura append-only existente.
Ambas rutas están detrás de `RoleRoute(ADMIN)` además del RBAC del backend. El
listado aplica filtros acotados por entidad, acción, actor, fechas e IDs; el
detalle presenta actor, razón y snapshots allowlisted, sin ofrecer mutaciones.
La navegación oculta Usuarios y Auditoría a `MECANICO`, pero esa ocultación es
sólo una ayuda de UX y no sustituye la autorización del API.

`/orders/new` es una ruta exclusiva para `ADMIN`. La página busca y selecciona
primero un cliente activo, carga únicamente sus motocicletas activas y confirma
el detalle de la elegida antes de habilitar el alta. Crear cliente o motocicleta
es una rama subordinada al resultado vacío; los conflictos de duplicado ofrecen
reutilización o restauración según el lifecycle. La asignación inicial es
opcional y el catálogo visual de mecánicos activos no sustituye la validación
autoritativa del backend.

`/orders` envía un scope explícito: `mine` para `MECANICO` y `all` o
`unassigned` para `ADMIN`. El detalle muestra el responsable actual; sólo
`ADMIN` puede asignar, reasignar o dejar una orden abierta sin responsable, con
razón y confirmación cuando reemplaza o retira una asignación existente.

Las acciones de estado se derivan de la misma matriz explícita que el backend.
Los tres retornos muestran etiquetas “Volver”, permanecen deshabilitados sin
motivo y requieren confirmación. Una orden entregada muestra a `ADMIN` un panel
separado que sólo ofrece `WARRANTY`/`SAME_ISSUE`, razón obligatoria y confirmación;
al completar usa el detalle devuelto por el backend y refresca el timeline.
Ocultar o bloquear controles es sólo UX: el servicio vuelve a comprobar arista,
ownership, lifecycle, unicidad abierta y razón bajo lock.

El detalle muestra el creador seguro de cada ítem cuando existe. En órdenes
cerradas conserva la tabla como evidencia, oculta alta/eliminación y explica la
protección del total; al reabrir, los controles permitidos reaparecen. No existe
flujo ni endpoint de edición de ítems.

React Router implementa guardas protegidas, anónimas y de `ADMIN`. Axios separa el cliente de negocio del cliente auth para evitar recursión. Un coordinador en memoria deduplica refresh concurrentes y limita cada 401 a un reintento.

El navegador nunca envía `status` o `total` autoritativos. Tras mutar, vuelve a consultar el detalle. Los subtotales informativos usan strings decimales/`BigInt`. Los controles ocultos por rol mejoran UX, pero el backend conserva la autoridad.

El access token sólo vive en memoria; el refresh token sólo en cookie `HttpOnly`. Para desarrollo, Axios usa `/api` y Vite lo redirige a `http://localhost:3000`; un frontend separado usa `VITE_API_BASE_URL` y debe coincidir exactamente con `FRONTEND_ORIGIN`.

## Convenciones API

- JSON bajo `/api`.
- Recurso: `{ "data": {} }`.
- Colección paginada: `{ "data": [], "meta": {} }`.
- Error: `{ "error": { "code": "...", "message": "..." } }`.
- Validación puede añadir `details` seguros.
- Historial: `created_at DESC, id DESC`.

Consulte [API](api.md).

## Estrategia de consultas

Los listados de clientes, motocicletas y órdenes son paginados y acotados a
100 filas. Motocicletas usa igualdad sobre el índice único para `plate`,
prefijo indexable para `platePrefix`, y los índices de lifecycle/propietario
para sus vistas administrativas. El filtro de placa de órdenes también es una
igualdad normalizada; no existe `LIKE '%placa%'`. Órdenes admite `bikeId`
exacto para la historia desde el detalle de moto y mantiene orden determinista
`entryDate DESC, id DESC`.

Los listados con relaciones ejecutan un `COUNT` sobre la tabla raíz —uniendo
sólo Bike cuando la placa lo exige— y una consulta de datos con includes
allowlisted. Por tanto el número de consultas es constante, sin N+1, y los
joins de Client, actor o responsable no inflan innecesariamente el conteo. Los
índices de orden general, estado, moto y asignación cubren las colas del
dashboard, All/My/Unassigned y la historia de una motocicleta. El resumen de
orden abierta continúa resolviéndose sin cargar ítems.

## Arquitectura de seguridad

El backend es la frontera de seguridad. bcrypt protege contraseñas; access JWT y refresh JWT usan secretos distintos; los usuarios activos se recargan desde MySQL; refresh tokens se guardan sólo como SHA-256 digest; RBAC se aplica en rutas y servicios; Helmet, CORS exacto, límite JSON y rate limiting se instalan antes del negocio.

La API JSON desactiva CSP porque no sirve HTML; la CSP corresponde al host del frontend. Consulte [Seguridad](security.md) y [ADR-002](decisions/ADR-002-refresh-token-rotation.md).

## Supuestos de operación y despliegue

- API y frontend son procesos separados del monorepo.
- MySQL es el único servicio de infraestructura obligatorio.
- No se necesitan caché, colas, WebSockets ni bus de eventos.
- En producción se requiere TLS, origen HTTPS exacto, cookies Secure, secretos gestionados, logs redactados y backups.
- Los `.docx` originales permanecen en la raíz y no forman parte de la implementación.
