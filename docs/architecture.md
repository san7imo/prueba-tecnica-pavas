# Arquitectura

## Estado y alcance

Este documento describe la arquitectura implementada al cierre de HITO 14: Fase 1 completa, autenticación, RBAC, auditoría, frontend autenticado, controles de seguridad y suite crítica de aceptación de Fase 2.

## Estilo arquitectónico

PAVAS Moto Workshop usa un **monolito modular por capas**. El dominio del taller es cohesivo, tiene siete entidades y requiere transacciones directas sobre una única base relacional. Una sola API Express permite conservar límites claros sin introducir costes operativos que la prueba no necesita.

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

- **Ítems y total:** el service abre una transacción, bloquea `work_orders` con `SELECT ... FOR UPDATE`, crea o elimina el ítem, recalcula `SUM(count * unit_value)` en MySQL y persiste el total antes de commit. El mismo lock serializa add/add y add/delete.
- **Creación de orden:** la orden `RECIBIDA` y su evento inicial `NULL -> RECIBIDA` se confirman o revierten juntas.
- **Cambio de estado:** el service bloquea la orden, relee el estado persistido, valida grafo y actor, actualiza y agrega exactamente un evento. Un competidor espera y valida contra el resultado confirmado.
- **Refresh:** la fila del token presentado se bloquea durante rotación. Una segunda utilización concurrente se interpreta defensivamente como replay.

El total se calcula con operandos `DECIMAL` y viaja como string; no se usa `Number` para dinero. Consulte [ADR-004](decisions/ADR-004-server-side-order-total.md).

El historial se consulta con límite/offset acotado, un join del actor que selecciona sólo ID/nombre y orden `created_at DESC, id DESC`. El índice físico `(work_order_id, created_at DESC, id DESC)` evita N+1 y soporta el desempate determinista.

## Persistencia y migraciones

MySQL 8/InnoDB es la fuente de verdad y Sequelize el mapper/query layer. Umzug ejecuta siete migraciones ESM y registra su estado en `SequelizeMeta`. No se usa `sequelize.sync` como estrategia de esquema.

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

El listado de órdenes usa `findAndCountAll` con el grafo `WorkOrder → Bike → Client`; `distinct: true` mantiene el conteo correcto. La petición protegida realiza una lectura de usuario, un count y una consulta de página, independientemente del número de resultados. La paginación usa 1/20 por defecto, máximo 100, y orden `entry_date DESC, id DESC`.

## Arquitectura de seguridad

El backend es la frontera de seguridad. bcrypt protege contraseñas; access JWT y refresh JWT usan secretos distintos; los usuarios activos se recargan desde MySQL; refresh tokens se guardan sólo como SHA-256 digest; RBAC se aplica en rutas y servicios; Helmet, CORS exacto, límite JSON y rate limiting se instalan antes del negocio.

La API JSON desactiva CSP porque no sirve HTML; la CSP corresponde al host del frontend. Consulte [Seguridad](security.md) y [ADR-002](decisions/ADR-002-refresh-token-rotation.md).

## Supuestos de operación y despliegue

- API y frontend son procesos separados del monorepo.
- MySQL es el único servicio de infraestructura obligatorio.
- No se necesitan caché, colas, WebSockets ni bus de eventos.
- En producción se requiere TLS, origen HTTPS exacto, cookies Secure, secretos gestionados, logs redactados y backups.
- Los `.docx` originales permanecen en la raíz y no forman parte de la implementación.
