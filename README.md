# PAVAS Moto Workshop

Prueba Técnica Full Stack JavaScript

## Descripción

PAVAS Moto Workshop es un producto web para operar el ciclo de servicio de un taller de motocicletas. Evoluciona el alcance de las fases 1 y 2 de la prueba de PAVAS S.A.S. con maestras completas de clientes y motocicletas, responsabilidad mecánica explícita, órdenes consistentes, retornos controlados del trabajo, garantías y trazabilidad empresarial.

El proyecto prioriza reglas de negocio explícitas, consistencia transaccional, seguridad, pruebas automatizadas y una instalación local reproducible. Los documentos originales de la prueba se conservan sin modificaciones en la raíz del repositorio.

## Funcionalidades

### Fase 1

- registro, búsqueda y consulta de clientes;
- registro y búsqueda de motocicletas con placa normalizada y única;
- creación, consulta, filtros y paginación de órdenes de trabajo;
- gestión transaccional de `MANO_OBRA` y `REPUESTO`;
- total autoritativo calculado por el backend con aritmética `DECIMAL`;
- máquina de estados con transiciones válidas y cancelación controlada;
- interfaz React para listado, creación y detalle de órdenes;
- estados de carga, error, vacío y prevención de envíos duplicados.

### Fase 2

- autenticación con access JWT y refresh token en cookie `HttpOnly`;
- rotación, revocación y detección de reutilización de refresh tokens;
- roles `ADMIN` y `MECANICO` con autorización en backend;
- administración básica de usuarios para `ADMIN`;
- historial inmutable de cambios de estado con actor, fecha y nota;
- timeline paginado en el detalle de la orden;
- sesión persistente y renovación transparente en el frontend;
- endurecimiento HTTP con Helmet, CORS restringido, límite de body y rate limiting.

Refresh/logout y la colección Postman eran opcionales en el enunciado original, pero este repositorio los implementa como parte de su contrato de ingeniería.

### Productización — hitos completados

- fundamentos de persistencia para ciclo de vida, responsable, actor de ítem y auditoría global;
- eventos empresariales append-only con snapshots explícitos y sin secretos;
- auditoría atómica de altas autenticadas, alta/eliminación de ítems y cambios de estado;
- consulta paginada/filtrada del audit global, exclusiva para `ADMIN`.
- lifecycle backend completo de clientes: edición, paginación, duplicados, soft delete y restore auditados.
- cédula de cliente normalizada y globalmente única, usada como búsqueda principal en clientes, motocicletas, órdenes y selección de propietario;
- lifecycle backend completo de motocicletas: búsqueda exacta/prefijo, propietario, edición, soft delete/restore, contexto de órdenes y auditoría.
- maestras frontend completas de clientes y motocicletas para `ADMIN`;
- una sola orden abierta por motocicleta, protegida también ante concurrencia;
- asignación o reasignación auditable de un único `MECANICO` activo;
- nueva orden guiada por reutilización: cliente existente → motocicleta activa del cliente → falla → responsable opcional.
- ownership operativo: cada `MECANICO` sólo consulta y muta sus órdenes asignadas;
- vista **Mis órdenes** para mecánicos y colas **Todas/Sin asignar** con gestión de responsable para `ADMIN`.
- retrocesos controlados y auditados cuando la reparación revela otra falla o una prueba final falla.
- reapertura administrativa de una orden entregada por garantía o la misma falla, con razón, history/audit y protección concurrente.
- ítems atribuidos al actor autenticado, inmutables mientras la orden está cerrada y nuevamente operables tras reapertura.
- protección del último `ADMIN` y de mecánicos con órdenes abiertas, con recuperación guiada por reasignación;
- dashboard operativo por rol, auditoría navegable y colas Todas/Mis órdenes/Sin asignar;
- búsquedas indexables, paginación acotada y consultas relacionales sin N+1;
- autorización, serialización, recuperación de sesión, teclado y responsive auditados de extremo a extremo.

## Stack tecnológico

| Área | Tecnologías |
|---|---|
| Backend | Node.js, Express, Sequelize, MySQL, JWT, bcrypt, Helmet |
| Frontend | React, React Router, Axios, Vite |
| Pruebas | Vitest, Supertest, React Testing Library |
| Calidad | ESLint, migraciones Umzug, npm audit |

Las versiones compatibles de Node.js declaradas por ambos paquetes son `^20.19.0 || ^22.13.0 || >=24.0.0`.

## Arquitectura

La solución es un monolito modular por capas, acompañado por una aplicación React independiente dentro del mismo repositorio:

```text
Frontend React
      ↓ HTTP/JSON
Express API
      ↓
Route → Auth/RBAC → Validation → Controller → Service → Repository
                                                           ↓
                                                      Sequelize
                                                           ↓
                                                        MySQL
```

Los servicios concentran reglas de negocio y transacciones; los repositorios concentran persistencia y bloqueos; el backend es siempre la autoridad para permisos, estados y totales. Consulte [Arquitectura](docs/architecture.md) y [ADR-001](docs/decisions/ADR-001-modular-monolith.md).

## Estructura del repositorio

```text
.
├── backend/
│   ├── migrations/       migraciones Sequelize/Umzug
│   ├── seeders/          seeds del ADMIN y datos demo
│   ├── src/              API modular por capas
│   └── tests/            pruebas unitarias y de integración
├── frontend/
│   ├── src/              interfaz React por funcionalidades
│   └── tests/            pruebas de componentes y sesión
├── docs/                 documentación, trazabilidad y ADR
├── docker/mysql/init/    creación de la base exclusiva de tests
├── postman/              colección y guía de uso
└── docker-compose.yml
```

## Requisitos previos

- Node.js compatible con los rangos anteriores;
- npm incluido con Node.js;
- Docker con el plugin Compose v2 (`docker compose`), opción recomendada;
- `docker-compose` standalone/legacy, sólo como compatibilidad secundaria;
- `openssl` recomendado para generar secretos.

MySQL 8.4 se ejecuta mediante Docker Compose. No se requiere Redis, colas ni infraestructura adicional.

## Instalación rápida

Los siguientes pasos parten de un clon limpio y usan los lockfiles versionados.

1. Clone el repositorio y entre en su carpeta:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Cree los archivos locales de entorno:

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Reemplace en `backend/.env` los secretos y la contraseña del seed. Genere dos secretos distintos, por ejemplo:

   ```bash
   openssl rand -hex 32
   openssl rand -hex 32
   ```

4. Levante MySQL y espere a que esté saludable:

   ```bash
   docker compose up -d mysql
   docker compose ps
   ```

   En instalaciones standalone/legacy puede usar `docker-compose` como alternativa compatible.

5. Instale el backend, aplique las migraciones y cree el ADMIN inicial:

   ```bash
   cd backend
   npm ci
   npm run db:migrate
   npm run db:migrate:status
   npm run db:seed:admin
   npm run dev
   ```

6. En otra terminal, instale y levante el frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

## Variables de entorno

El archivo raíz `.env` configura el contenedor MySQL. `backend/.env` configura la API y `frontend/.env` el cliente.

| Variable | Uso |
|---|---|
| `DB_HOST`, `DB_PORT` | host y puerto de MySQL vistos por la API |
| `DB_NAME` | base de desarrollo, por defecto `pavas_workshop` |
| `DB_NAME_TEST` | base exclusiva de integración, por defecto `pavas_workshop_test` |
| `DB_USER`, `DB_PASSWORD` | credenciales locales de MySQL |
| `JWT_ACCESS_SECRET` | firma del access token; mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | firma distinta para refresh; mínimo 32 caracteres |
| `JWT_ACCESS_EXPIRES_IN` | vida del access token, por defecto `15m` |
| `JWT_REFRESH_EXPIRES_IN` | vida del refresh token, por defecto `7d` |
| `BCRYPT_ROUNDS` | coste bcrypt entre 10 y 15 |
| `FRONTEND_ORIGIN` | origen exacto autorizado por CORS |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | política de la cookie de refresh |
| `ADMIN_SEED_NAME` | nombre del ADMIN inicial |
| `ADMIN_SEED_EMAIL` | email normalizado del ADMIN inicial |
| `ADMIN_SEED_PASSWORD` | contraseña del seed, mínimo 12 caracteres |
| `VITE_API_BASE_URL` | base de la API; `/api` usa el proxy local de Vite |

No reutilice secretos, no use valores de ejemplo en producción y nunca versione archivos `.env`. La API valida al iniciar que los secretos sean distintos y que la configuración de producción sea segura. Consulte [Seguridad](docs/security.md).

## Base de datos

El proyecto usa dos bases separadas:

```text
desarrollo: pavas_workshop
pruebas:    pavas_workshop_test
```

Las siete migraciones originales crean `clients`, `bikes`, `work_orders`,
`work_order_items`, `users`, `refresh_tokens` y `work_order_status_history`.
Ocho migraciones posteriores agregan lifecycles, `audit_events`, responsable,
actor de ítem, normalización de contactos, unicidad de orden abierta e índices
para las consultas operativas, además de la cédula única del cliente.

| Comando backend | Propósito |
|---|---|
| `npm run db:migrate` | aplica todas las migraciones pendientes |
| `npm run db:migrate:status` | muestra migraciones ejecutadas y pendientes |
| `npm run db:migrate:down` | revierte la última migración |
| `npm run db:migrate:test` | aplica migraciones sobre la base de tests |
| `npm run db:migrate:reset:test` | revierte toda la base de tests; es destructivo y exclusivo de `NODE_ENV=test` |

No se usa `sequelize.sync({ alter: true })`. Consulte [Base de datos](docs/database.md).

## Seed y primer inicio de sesión

Configure `ADMIN_SEED_NAME`, `ADMIN_SEED_EMAIL` y `ADMIN_SEED_PASSWORD` en `backend/.env`, ejecute las migraciones y luego:

```bash
cd backend
npm run db:seed:admin
```

El seed normaliza el email, aplica bcrypt y crea un usuario `ADMIN` activo. Es idempotente: si el mismo email ya pertenece a un `ADMIN`, no lo duplica; si pertenece a otro rol, falla de forma explícita. La contraseña nunca se imprime ni se versiona.

Después de levantar ambos procesos, abra `http://localhost:5173` e inicie sesión con el email y la contraseña que configuró localmente.

## Datos de demostración

Después de aplicar las migraciones y crear el ADMIN inicial, puede cargar un conjunto opcional de datos para evaluación visual o desarrollo:

```bash
cd backend
npm run db:seed:demo
```

El comando crea clientes, motocicletas, órdenes, ítems, historiales coherentes y tres usuarios `MECANICO`. Es idempotente: reconoce sus registros por el dominio reservado `@demo.pavas.test`, las placas `DMO###` y el prefijo `[DEMO]`, y no duplica ni elimina datos existentes.

Los mecánicos demo usan los correos `mecanico.demo.01@demo.pavas.test` a `mecanico.demo.03@demo.pavas.test` y la contraseña compartida `DemoMechanic-2026!`.

Este seed requiere un ADMIN activo, es exclusivamente para desarrollo/evaluación y se niega a ejecutarse con `NODE_ENV=production`.

## URLs locales

| Servicio | URL predeterminada |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3000` |
| Health | `http://localhost:3000/api/health` |
| MySQL | `127.0.0.1:3306` |

El puerto host de MySQL puede cambiarse con `DB_PORT` en el `.env` raíz y debe coincidir en `backend/.env`.

## Comandos

### Backend

| Comando | Propósito |
|---|---|
| `npm run dev` | inicia la API con recarga de Node.js |
| `npm start` | inicia la API sin modo watch |
| `npm test` | ejecuta 28 suites sobre MySQL de pruebas |
| `npm run test:watch` | ejecuta Vitest en modo interactivo |
| `npm run lint` | valida el código con ESLint |
| `npm run db:seed:admin` | crea de forma idempotente el ADMIN inicial |
| `npm run db:seed:demo` | carga datos opcionales, idempotentes y exclusivos de desarrollo/demo |

### Frontend

| Comando | Propósito |
|---|---|
| `npm run dev` | inicia Vite en desarrollo |
| `npm run build` | genera el bundle de producción |
| `npm run preview` | sirve localmente el bundle generado |
| `npm test` | ejecuta 15 suites de Vitest/RTL |
| `npm run test:watch` | ejecuta Vitest en modo interactivo |
| `npm run lint` | valida el código con ESLint |

## Flujo de demostración

Recorrido recomendado para el evaluador:

```text
Login ADMIN
  → crear cliente
  → crear motocicleta
  → crear orden
  → agregar REPUESTO y MANO_OBRA
  → verificar el total
  → cambiar el estado
  → consultar el historial
  → entregar
  → reabrir por garantía en diagnóstico
```

Para comprobar RBAC, cree un usuario `MECANICO`, inicie sesión con él y
asígnele una orden. Verifique que sólo puede consultar esa orden, agregarle
ítems y avanzar por estados intermedios; una orden asignada a otra persona o sin
responsable debe responder 403. Tampoco puede crear órdenes, cambiar
responsables, entregar/cancelar, borrar ítems ni administrar usuarios.

## Reglas de negocio principales

```text
RECIBIDA → DIAGNOSTICO → EN_PROCESO → LISTA → ENTREGADA
```

`CANCELADA` es válida desde `RECIBIDA`, `DIAGNOSTICO`, `EN_PROCESO` o `LISTA`. `ENTREGADA` y `CANCELADA` son terminales para el PATCH genérico. Las transiciones inválidas o al mismo estado devuelven HTTP 400 y no generan historial.

Con un motivo obligatorio, `EN_PROCESO` puede volver a `DIAGNOSTICO` y
`LISTA` puede volver a `DIAGNOSTICO` o `EN_PROCESO`. Esos retornos quedan en el
historial y en la auditoría como `REGRESSION`; no habilitan ningún retroceso a
`RECIBIDA` ni la reapertura de una orden entregada.

Sólo `ADMIN` puede reabrir una orden `ENTREGADA` mediante la operación dedicada:
`WARRANTY` o `SAME_ISSUE`, motivo obligatorio, motocicleta/propietario activos y
ninguna otra orden abierta. El resultado vuelve a `DIAGNOSTICO` y queda en
history y audit `REOPENED`; una falla distinta se registra como orden nueva.

Los ítems sólo se agregan o eliminan mientras la orden está abierta. Cada alta
guarda el actor autenticado; sólo `ADMIN` elimina y ambas operaciones recalculan
el total exacto junto con su audit. `ENTREGADA`/`CANCELADA` protegen la evidencia;
reabrir a `DIAGNOSTICO` vuelve a permitir trabajo según el rol. No existe edición
de ítems.

- `ADMIN`: acceso completo a las acciones implementadas.
- `MECANICO`: lectura, creación de ítems y avance a `DIAGNOSTICO`,
  `EN_PROCESO` y `LISTA` únicamente sobre órdenes propias asignadas; sin
  creación de órdenes/maestras, asignación, administración, borrado de ítems,
  entrega o cancelación.

Consulte [Reglas de negocio](docs/business-rules.md).

## Pruebas

Con MySQL saludable y los entornos locales configurados:

```bash
cd backend
npm test
npm run lint

cd ../frontend
npm test
npm run lint
npm run build
```

El backend se niega a ejecutar preparación destructiva si `NODE_ENV` no es `test`, si el nombre no contiene `test` o si coincide con la base de desarrollo. No ejecute las suites contra datos reales.

Release verificado desde instalación y base limpias en HITO 20:

```text
Backend:        28 suites, 342 pruebas
Frontend:       15 suites, 104 pruebas
Matriz crítica: 235 casos/filas PASS
Migraciones:    14 ejecutadas, 0 pendientes
```

El gate incluyó seeds idempotentes, recorrido HTTP completo por ambos roles,
soft delete/restore, concurrencia crítica, auditoría segura y smoke del build.

Extensión de identificación de clientes verificada el 2026-09-05:

```text
Backend:        28 suites, 348 pruebas
Frontend:       15 suites, 105 pruebas
Matriz crítica: 241 casos/filas PASS
Migraciones:    15 ejecutadas, 0 pendientes
```

La base demo fue reconstruida desde cero: sus 20 clientes tienen cédulas no
nulas y únicas; una segunda ejecución de ambos seeds no modificó datos.

Consulte [Estrategia de pruebas](docs/testing.md) y [Matriz de aceptación](docs/test-acceptance-matrix.md).

## Postman

Importe `postman/PAVAS-Moto-Workshop.postman_collection.json`, configure `adminEmail` y `adminPassword`, y confirme que `baseUrl` sea `http://localhost:3000/api` o la URL de su API.

Ejecute primero `Salud / Comprobar API` y `Autenticación / Iniciar sesión`.
El script guarda `accessToken`; el cookie jar de Postman conserva la cookie
`HttpOnly`. La colección cubre usuarios, lifecycle completo de clientes y
motocicletas, asignación, estados, reapertura, ítems, historial y auditoría. No
incluye credenciales reales. Consulte [Guía de Postman](postman/README.md).

## Resumen de seguridad

- bcrypt con coste mínimo 10;
- access JWT de vida corta y secreto dedicado;
- refresh JWT en cookie `HttpOnly`, con rotación y detección de reutilización;
- autorización RBAC en backend;
- CORS de origen exacto, Helmet y body JSON de 100 KiB;
- rate limiting específico para login;
- validación de entrada y errores públicos sanitizados;
- consultas Sequelize parametrizadas y restricciones de MySQL;
- historial inmutable con actor autenticado.

## Ambientes

| Ambiente | Base de datos | Cookies/CORS | Secretos |
|---|---|---|---|
| `development` | `DB_NAME` | HTTP local, origen exacto | valores locales no versionados |
| `test` | `DB_NAME_TEST` | configuración controlada por suites | fixtures deterministas |
| `production` | base dedicada | HTTPS, `COOKIE_SECURE=true`, origen HTTPS exacto | gestor de secretos recomendado |

## Consideraciones para producción

- terminar TLS en un proxy confiable y definir conscientemente `trust proxy` antes de usar IP del cliente;
- almacenar y rotar secretos en un gestor dedicado;
- usar un rate limiter distribuido o WAF si se despliegan varias instancias;
- configurar CSP en el host del frontend;
- centralizar logs redactados, métricas, alertas y respaldos de MySQL;
- ejecutar migraciones, pruebas y audits como gates del despliegue.

Este repositorio no implementa infraestructura de despliegue.

## Supuestos y limitaciones conocidas

- MySQL 8/InnoDB es el motor objetivo.
- No se impone una expresión regular de placa colombiana; sólo normalización técnica y unicidad.
- No hay MFA ni recuperación de contraseña. El último `ADMIN` y los mecánicos
  con trabajo abierto sí están protegidos por reglas transaccionales.
- El rate limiter es local al proceso.
- No se incluye logout de todos los dispositivos.
- Sequelize 6.37.8 incorpora transitivamente `uuid` 8.3.2 con un advisory moderado relacionado con APIs de UUID que esta aplicación no invoca. El fix automático propone un downgrade incompatible a Sequelize 3; por ello no se ejecutó `npm audit fix --force`. El riesgo residual está analizado en [Seguridad](docs/security.md).

## Documentación

- [Arquitectura](docs/architecture.md)
- [API](docs/api.md)
- [Base de datos](docs/database.md)
- [Reglas de negocio](docs/business-rules.md)
- [Seguridad](docs/security.md)
- [Estrategia de pruebas](docs/testing.md)
- [Matriz crítica de aceptación](docs/test-acceptance-matrix.md)
- [Trazabilidad de requisitos](docs/requirements-traceability.md)
- [Checklist de entrega](docs/submission-checklist.md)
- [Recorrido de demostración](docs/demo-walkthrough.md)
- [ADR-001 — Monolito modular](docs/decisions/ADR-001-modular-monolith.md)
- [ADR-002 — Rotación de refresh tokens](docs/decisions/ADR-002-refresh-token-rotation.md)
- [ADR-003 — Máquina de estados](docs/decisions/ADR-003-work-order-state-machine.md)
- [ADR-004 — Total calculado en servidor](docs/decisions/ADR-004-server-side-order-total.md)
- [ADR-005 — Lifecycle de maestras y auditoría empresarial](docs/decisions/ADR-005-master-data-lifecycle-and-business-audit.md)
- [ADR-006 — Una orden abierta y estrategia de locks](docs/decisions/ADR-006-single-open-order-and-locking.md)
- [ADR-007 — Responsable único y retornos controlados](docs/decisions/ADR-007-assignment-and-controlled-workflow-return.md)
- [Postman](postman/README.md)

## Decisiones arquitectónicas

Los siete ADR aceptados explican las decisiones estructurales y de producto:
monolito modular, refresh tokens rotativos, máquina de estados explícita, total
transaccional, lifecycle/auditoría, unicidad de orden abierta y responsabilidad
mecánica con retornos controlados. No se añadieron microservicios, cachés, colas
ni dependencias sin una necesidad del alcance.
