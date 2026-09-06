# Estrategia de pruebas

## Principio

La aceptación se guía por requisitos y riesgo, no por un porcentaje de cobertura. Vitest se usa en ambos paquetes; Supertest ejercita Express sin abrir puerto y React Testing Library comprueba comportamiento visible. ESLint se ejecuta por paquete.

Inventario verificado:

```text
Backend:  28 suites, 342 pruebas
Frontend: 15 suites, 104 pruebas
Matriz:   235 filas PASS
```

La evidencia requisito → riesgo → test nombrado vive en [test-acceptance-matrix.md](test-acceptance-matrix.md).

## Flujo de auditoría

```text
Fase 1 + Fase 2 + AGENTS.md
  → trazabilidad
  → evidencia automatizada nombrada
  → cierre de brechas
  → regresión completa
  → repetición de concurrencia/orden
  → smoke API/navegador real
```

Tests de persistencia, HTTP y componentes pueden superponerse si demuestran fronteras diferentes: por ejemplo, validación de request frente a CHECK físico.

## Base exclusiva de integración

Desarrollo usa `pavas_workshop`; integración usa `pavas_workshop_test` o `DB_NAME_TEST`.

Guardas obligatorias:

- `NODE_ENV=test`;
- nombre resuelto desde `DB_NAME_TEST`;
- rechazo de producción, de la base de desarrollo o de un nombre que no contenga `test`;
- migraciones antes de integrar;
- fixtures deterministas sin seeds demo implícitos;
- limpieza/aislamiento entre casos;
- orden de tests irrelevante;
- cierre de conexiones.

```text
beforeAll: conectar y aplicar migraciones
beforeEach/helper: limpiar tablas o crear fixtures aislados
tests
afterAll: cerrar Sequelize
```

Los tests ordinarios pueden usar rollback. Las carreras requieren filas confirmadas y conexiones separadas, por lo que usan limpieza determinista. Los archivos MySQL se ejecutan secuencialmente porque comparten el esquema de integración.

El seed de demostración nunca se ejecuta implícitamente. `demoSeed.integration.test.js` lo invoca de forma explícita y comprueba la protección de producción, la necesidad de un ADMIN activo, cantidades deterministas, bcrypt, FKs, estados, totales, historial, idempotencia y preservación de datos ajenos.

## Suites backend

### Fundación y configuración

- `health.test.js`: `GET /api/health`.
- `notFound.test.js`: envelope 404 centralizado.
- `testDatabaseGuard.test.js`: rechazo de objetivos destructivos inseguros.
- `applicationConfig.test.js` y `authConfig.test.js`: ambientes, origen, secretos, duración y cookies.
- `authorize.test.js`: paso/401/403 del middleware de rol.

### Esquema — `schema.integration.test.js`

- aplica las catorce migraciones desde cero;
- verifica asociaciones, FKs, ENUM, UNIQUE y CHECK;
- verifica columnas lifecycle, tabla/índices de audit, asignación y actor de ítem;
- prueba placa normalizada y `DECIMAL` como string;
- valida columnas/índice descendente del historial y FKs `RESTRICT`;
- revierte todas, confirma ausencia y reaplica.

### Upgrade de productización — `productizationSchema.integration.test.js`

- aplica primero las siete migraciones originales;
- inserta filas legacy relacionadas;
- aplica 008–014 y confirma campos nuevos nulos, canonicalización segura,
  guard de orden abierta e índices operativos sin pérdida de datos;
- revierte 008–014, confirma que las filas originales sobreviven y reaplica.

La suite omite deliberadamente validación de modelo en casos concretos para demostrar que MySQL sigue siendo barrera final.

### Migración de contactos — `clientContactMigration.integration.test.js`

- canonicaliza phone/email válidos y conserva `updated_at`;
- down/reapply data-only permanece idempotente sin inventar formato perdido;
- preflight inválido aborta antes de modificar una fila;
- diagnóstico expone sólo IDs/campos, no contactos persistidos.

### Auditoría global — `auditSnapshots.test.js` y `audit.integration.test.js`

- allowlists completas de snapshots y metadata determinista;
- exclusión de password, hash, tokens, cookies y secretos;
- actor tomado de autenticación aunque el body intente inyectarlo;
- eventos atómicos para altas, ítems, estados y cancelación;
- rollback de maestras, usuario, orden/history, ítem/total y estado/history ante fallo del evento;
- filtros, fechas, paginación, detalle y actor seguro;
- lectura sólo `ADMIN`, autenticación antes de validación y ausencia de API de mutación;
- cero eventos para operaciones rechazadas.

### Clientes y motocicletas — `clientsBikes.integration.test.js`

- creación, opcionales, normalización, allowlist y validaciones;
- búsqueda parcial por nombre/teléfono/email;
- detalle, 404 e ID inválido;
- motocicleta con cliente anidado;
- duplicados exactos, por mayúsculas y espacios → 409;
- relación de cliente inválida y búsqueda de placa normalizada.

### Lifecycle de clientes — `clientLifecycle.integration.test.js`

- phone/email canónicos, formatos inválidos y nombre no único;
- conflicto activo, override justificado y deleted-match restore-required;
- listado paginado active/deleted/all, búsqueda y frontera ADMIN/MECANICO;
- PATCH allowlist, clear email, no-op y audit before/after desacoplado;
- soft delete sin borrado físico, reason y bloqueo por motos activas;
- restore sin cascada de motos y override duplicado trazable;
- rollback de update/delete/restore cuando falla audit;
- carrera delete cliente/crear moto serializada por lock del cliente.

### Lifecycle de motocicletas — `bikeLifecycle.integration.test.js`

- placa global única y conflicto restore-required para una identidad eliminada;
- listado paginado por lifecycle/propietario, igualdad exacta y prefijo indexable;
- detalle con propietario y orden abierta, más historia paginada por `bikeId`;
- PATCH allowlisted, no-op, colisiones y snapshots before/after desacoplados;
- owner change dedicado, destino activo, razón y audit anterior/nuevo;
- soft delete bloqueado por orden abierta y restore condicionado al propietario;
- mutaciones sólo `ADMIN` y recursos eliminados fuera de flujos operativos;
- rollback de update/owner/delete/restore cuando falla audit;
- carreras delete moto/crear orden y owner change/delete cliente serializadas.

### Órdenes e ítems — `workOrders.integration.test.js`

- orden válida/inválida, fecha explícita/omitida y defaults `RECIBIDA`/`0.00`;
- protección de mass assignment;
- listas vacías/pobladas, placa exacta sin subcadena, filtros, paginación y orden `entryDate DESC, id DESC`;
- grafo Bike/Client/items y ausencia de N+1;
- forma SQL sin `LIKE` para placa y count sin joins ajenos al filtro;
- ambos tipos de ítem, cantidades fraccionarias y valor cero;
- escalas/rangos y recursos ausentes;
- total 130000 y exactitud `0.10 + 0.20 = 0.30`;
- rollback si falla persistir total;
- delete, último ítem `0.00`;
- carreras add/add y add/delete con conexiones distintas y `FOR UPDATE`.

### Consultas operativas — `operationalQueries.integration.test.js`

- inventario exacto de los tres índices de HITO 15 y conservación de los
  índices previos de asignación/orden abierta;
- `down`/reapply reversible sin pérdida de filas;
- fixture de 2.400 órdenes y `ANALYZE TABLE` para planes representativos;
- `EXPLAIN` verifica `uq_bikes_plate`, las colas por estado, la historia por
  moto y My Orders sin `Using filesort`;
- el índice de All se fuerza únicamente dentro de `EXPLAIN` para probar que
  satisface el orden completo sin convertir una decisión costo-dependiente del
  optimizador de MySQL en una prueba frágil.

### Lifecycle de ítems — `workOrderItemLifecycle.integration.test.js`

- `ADMIN` y `MECANICO` asignado quedan atribuidos desde autenticación; un actor enviado en body se ignora;
- detalle/respuesta exponen sólo ID/nombre del creador y preservan `null` para filas legacy;
- `ENTREGADA`/`CANCELADA` rechazan add/delete con `409 WORK_ORDER_CLOSED` sin alterar total, ítem o audit;
- delete permanece `ADMIN`-only antes de validar ID y no existe PATCH de ítem;
- reopen vuelve a habilitar add por mecánico propio y delete por ADMIN;
- `ITEM_DELETED` conserva snapshot anterior con creador y actor del borrado;
- fallo audit revierte delete y total;
- add contra delivery, delete contra cancellation y add contra reopen producen resultados serializables con total exacto.

### Asignación de órdenes — `workOrderAssignment.integration.test.js`

- creación con responsable opcional y un único evento `CREATED`;
- rechazo de usuario inexistente, inactivo o con rol distinto de `MECANICO`;
- asignación, reasignación y unassignment con razones condicionales;
- orden cerrada y no-op sin cambios ni auditoría;
- filtro exacto por responsable y representación explícita de unassigned;
- autorización `ADMIN` antes de validación y allowlists de entrada;
- rollback completo si falla audit;
- dos reasignaciones concurrentes producen un único cambio/evento confirmado.

### Ownership de órdenes — `workOrderOwnership.integration.test.js`

- `MECANICO` lista por defecto y exclusivamente las órdenes asignadas a su identidad;
- scopes `all`/`unassigned` y filtros por otra persona se rechazan para mecánicos;
- `ADMIN` conserva vistas all/unassigned y filtro exacto por responsable;
- detalle e historial de órdenes ajenas o sin asignar devuelven 403;
- estado e ítems verifican ownership dentro de la transacción bloqueada y no dejan efectos al rechazar;
- una reasignación revoca inmediatamente a la persona anterior y habilita a la nueva.

### Estados — `workOrderStatus.integration.test.js`

- ruta forward completa y cancelación desde cuatro estados;
- matriz 6×6 con las tres regresiones explícitas, mismo estado, terminales y target desconocido;
- regresiones disponibles para `ADMIN` y `MECANICO` asignado;
- motivo normalizado obligatorio, history y audit `REGRESSION` exactos;
- rollback conjunto de estado/history cuando falla audit y conservación del total;
- carreras `RECIBIDA → DIAGNOSTICO/CANCELADA` y `LISTA → ENTREGADA/CANCELADA`;
- evidencia SQL de transacciones y locks independientes.

La respuesta perdedora nombra el estado confirmado por la ganadora, demostrando revalidación después del lock.

### Reapertura — `workOrderReopen.integration.test.js`

- ambos tipos (`WARRANTY`/`SAME_ISSUE`) regresan exclusivamente de `ENTREGADA` a `DIAGNOSTICO`;
- razón obligatoria/normalizada, ID, allowlist de tipo, 401/403 y 404;
- recursos activos y ausencia de otra orden abierta;
- conservación de total/responsable y contenido exacto de history/audit `REOPENED`;
- el PATCH genérico mantiene prohibido `ENTREGADA → DIAGNOSTICO`;
- fallo audit revierte estado e history;
- dos reopens dejan sólo uno confirmado;
- reopen contra alta de una falla distinta deja exactamente una orden abierta;
- reopen contra delete de motocicleta nunca deja una moto eliminada operativa.

### Autenticación — `auth.integration.test.js`

- bcrypt, seed ADMIN idempotente y login normalizado;
- error genérico e inactivo, con comparación bcrypt también para email inexistente;
- claims/access y `/me` seguro;
- tokens ausentes, malformados, expirados, firma/algoritmo/propósito incorrectos y usuario/rol obsoleto;
- atributos de cookie y persistencia sólo del digest;
- refresh válido/inválido/expirado, rotación y enlaces;
- replay, familias independientes y revocación;
- logout idempotente y rate limit 429;
- dos refresh concurrentes: sólo uno rota y el replay deja cero descendientes activos;
- flujo CORS credentialed login → refresh → negocio → logout;
- origen hostil rechazado antes de poder rotar o revocar la sesión cookie.

### RBAC/usuarios — `rbac.integration.test.js`

- 401 antes de validación y 403 por rol;
- `ADMIN` crea clientes/motos/órdenes; ambos roles leen activos y agregan ítems;
- sólo `ADMIN` elimina ítems y administra usuarios;
- registro, email duplicado normalizado y payload seguro;
- listado, cambio de rol y active con validación/404;
- invalidación inmediata de tokens tras rol/active;
- tres transiciones permitidas al `MECANICO` y 403 en entrega/cancelación;
- separación 400 por workflow y 403 por permiso.

### Lifecycle de usuarios — `userLifecycle.integration.test.js`

- razón obligatoria y acotada para cambio de rol o actividad;
- protección contra desactivar o degradar al último `ADMIN` activo;
- bloqueo de desactivación/remoción de rol para mecánicos con órdenes abiertas;
- reasignación previa que desbloquea de forma explícita la desactivación;
- auditoría segura y atómica de rol/actividad con actor y razón;
- carrera entre dos reducciones de administradores que conserva uno activo;
- carrera asignación/desactivación que nunca deja trabajo en un usuario inactivo;
- autenticación y RBAC evaluados antes que la validación contextual.

### Historial — `workOrderHistory.integration.test.js`

- evento inicial exacto `NULL -> RECIBIDA` y rollback si falla;
- actor, timestamp, from/to, nota y cancelación;
- cero filas para intentos inválidos/idempotentes/terminales/prohibidos;
- rollback de estado si falla auditoría;
- lectura de ambos roles, 401, 404 y actor seguro;
- paginación/validación, máximo 100;
- 150 timestamps empatados en páginas 100/50 y desempate ID desc;
- misma transición concurrente: un 200, un 400, una fila.

En la medición local del 2026-08-24, una petición autenticada de 100 filas entre 150 tardó **9.40 ms** en MySQL Docker 8.4. `EXPLAIN` eligió `ix_work_order_status_history_order_created_id`. Es evidencia a escala de prueba, no SLA de producción.

### Seguridad HTTP — `security.test.js`

Comprueba Helmet, ausencia de `X-Powered-By`, decisión CSP, HSTS por ambiente, CORS exacto/preflight/no-Origin, JSON 100 KiB, JSON malformado y 500 sanitizado. `notFound.test.js` prueba además que el 404 genérico no refleja path, query ni valores potencialmente sensibles.

## Suites frontend

Los componentes mockean módulos API estrechos, no componentes internos. Así se ejercitan rutas, estado, formularios y resultados visibles de forma determinista. `httpClientAuth.test.js` usa interceptores reales con adapter controlado.

### Fase 1

- shell, rutas y not-found;
- listado en carga/vacío/error/retry/poblado;
- filtros y paginación del servidor;
- búsqueda/selección de Bike y payload sin status/total;
- registro rápido Client → Bike;
- bloqueo de envío duplicado;
- detalle, ítems, total autoritativo y 404;
- subtotales exactos sin float;
- add/delete con confirmación/refetch;
- transiciones válidas, terminales y errores.

### Sesión, roles e historial

- bootstrap por refresh, restauración y fallback anónimo;
- login, redirects y guardas protegidas/ADMIN;
- token sólo en memoria y un reintento máximo;
- cinco 401 concurrentes resueltos por exactamente un refresh;
- fallo de refresh limpia sesión y logout fallido limpia memoria;
- administración de usuarios: lista, alta, rol explícito y active;
- controles `ADMIN`/`MECANICO`;
- nota de transición y refetch;
- timeline con actor/from/to/note/evento inicial/paginación/errores.

### Nueva orden productizada — `NewWorkOrderPage.test.jsx`

- acceso exclusivo de `ADMIN` también en la guarda de ruta;
- búsqueda y selección de cliente activo antes de consultar sus motocicletas;
- alta subordinada de cliente/motocicleta sólo después de una búsqueda vacía;
- reutilización de coincidencia activa, override justificado y restauración para eliminados;
- selección restringida a motocicletas activas del cliente;
- bloqueo y enlace a la orden abierta detectada antes de enviar;
- conflicto `BIKE_HAS_ACTIVE_WORK_ORDER` tardío tratado sin duplicar el submit;
- responsable inicial limitado visualmente a mecánicos activos u opción unassigned;
- catálogo de mecánicos recuperable y rechazo autoritativo de una selección desactualizada.

### Ownership y colas operativas

- navegación y título **Mis órdenes** para `MECANICO`, siempre con `scope=mine`;
- listado `ADMIN` alterna entre **Todas** y **Sin asignar** y muestra el responsable;
- estados vacíos se adaptan al rol y al scope activo;
- el detalle muestra el responsable al mecánico sin exponer controles administrativos;
- `ADMIN` asigna sin razón desde unassigned y exige razón/confirmación para reasignar o desasignar;
- carga y retry del catálogo, doble submit y órdenes cerradas se manejan explícitamente.

### Retrocesos controlados — `WorkOrderDetailPage.test.jsx`

- `EN_PROCESO` ofrece volver a diagnóstico y `LISTA` ofrece diagnóstico o reparación;
- `MECANICO` conserva los retornos sobre su detalle sin recibir entrega/cancelación;
- los botones de regresión permanecen deshabilitados mientras el motivo esté vacío;
- una regresión exige confirmación y envía target/motivo al API sólo al aceptar;
- las etiquetas distinguen regresar de avanzar y el backend sigue siendo autoritativo.

### Reapertura administrativa — `WorkOrderDetailPage.test.jsx` y `apiModules.test.js`

- sólo `ADMIN` ve el panel y únicamente sobre una orden `ENTREGADA`;
- el selector ofrece exclusivamente garantía/misma falla y la razón bloquea el envío vacío;
- la confirmación precede el request y la operación usa el endpoint/payload dedicado;
- éxito actualiza el detalle devuelto y refresca history; conflicto muestra el mensaje seguro;
- el estado de carga impide doble envío; `MECANICO` y `CANCELADA` no exponen la acción.

### Ítems protegidos — `WorkOrderDetailPage.test.jsx`

- cada fila muestra el nombre seguro del creador cuando está disponible;
- una orden cerrada conserva la tabla pero oculta alta/eliminación y explica la protección;
- tras reapertura reaparecen los controles permitidos;
- un `WORK_ORDER_CLOSED` causado por estado desactualizado se muestra al usuario.

### Dashboard y auditoría operativa

- `DashboardPage.test.jsx` cubre las cuatro colas abiertas para `ADMIN`, el
  scope propio para `MECANICO`, accesos por rol, vacío, error y retry;
- `AuditPages.test.jsx` cubre listado, filtros acotados, detalle inmutable,
  contexto legible, validación local, vacío, error y retry;
- `App.test.jsx` verifica navegación y guardas para Dashboard y Audit.

### Accesibilidad y polish

- campos requeridos y labels asociados;
- regiones de tablas etiquetadas y enfocables;
- cambio de rol separado de guardar;
- labels operativos para acciones sin cambiar enums;
- estados loading/error/empty/disabled/retry/confirmación;
- navegación y permisos por rol.

### Recuperabilidad y responsive — HITO 17

- login conserva pathname, query y hash del destino protegido;
- logout pendiente se deshabilita y no duplica requests;
- navegación SPA entrega foco al contenido principal;
- edición de clientes/motocicletas permite retry sin abandonar la ruta;
- conflictos de placa y lifecycle de mecánico enlazan a vistas filtradas donde
  la persona puede restaurar o reasignar;
- orden, motocicleta y cliente relacionados son navegables por nombre/placa;
- búsqueda de propietario conserva interacción por teclado sin formularios HTML
  anidados;
- `responsiveStyles.test.js` protege los breakpoints estructurales de
  navegación, detalle, formularios, tablas y alertas accionables.

## Comandos

```bash
cd backend
npm test
npm run lint

cd ../frontend
npm test
npm run lint
npm run build
```

Si Compose expone MySQL en otro puerto:

```bash
cd backend
DB_PORT=33306 npm test
```

Migraciones:

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:migrate:down
npm run db:migrate:test
npm run db:migrate:reset:test
```

El reset completo es exclusivo de tests.

## Concurrencia y repetibilidad

Las carreras usan fixtures confirmados y conexiones separadas:

- refresh/refresh bloquea la fila de token;
- add/add y add/delete comparten lock de WorkOrder;
- add/delete contra close/reopen comparten el mismo lock y revalidan estado;
- estados releen bajo `FOR UPDATE`;
- ítems y estados releen ownership bajo el lock de WorkOrder;
- la reasignación cambia inmediatamente quién puede consultar y operar la orden;
- mismo target deja exactamente un evento;
- 150 eventos empatados prueban el desempate por ID.

La verificación de HITO 18 repitió siete casos críticos tres veces en procesos
Vitest frescos: 21 passes, cero fallos. Incluyó refresh, alta de orden,
reasignación, transición, reapertura, mutación de ítem y reducción de
administradores.

## Registro consolidado HITO 18 — 2026-09-03

- backend completo: 28/28 suites, 342/342 pruebas;
- frontend completo: 15/15 suites, 104/104 pruebas;
- concurrencia focalizada: 7 casos × 3 procesos = 21/21;
- lint backend/frontend: pass;
- build frontend: pass, 129 módulos transformados;
- migraciones de desarrollo: 14 ejecutadas, cero pendientes;
- historial paginado observado en esta ejecución: 9.48 ms para 100 de 150
  eventos empatados;
- matriz crítica: 235 requisitos/riesgos con evidencia `PASS`.

## Validación documental HITO 19 — 2026-09-03

- colección Postman parseada como JSON y scripts compilados: 7 carpetas,
  36 requests y 33/33 patrones de endpoint cubiertos;
- enlaces Markdown locales de README, docs, ADR y guía Postman: todos resuelven;
- trazabilidad: 214 IDs únicos, 208 `Done`, 6 `Foundation` y cero `Pending`;
- `git diff --check`: sin errores de whitespace.
- backend: 28/28 suites, 342/342 pruebas y lint en pass;
- frontend aislado: 15/15 suites, 104/104 pruebas, lint y build en pass;
- migraciones de desarrollo: 14 ejecutadas, cero pendientes.

Una primera ejecución paralela de backend/frontend agotó el timeout de 5 s en
9 pruebas UI (95 pasaron) por contención local mientras la integración MySQL
seguía activa. Sin modificar código ni timeouts, la repetición frontend aislada
pasó 104/104 en 9.96 s; ese es el gate válido reportado.

Esta validación comprueba estructura y consistencia documental; el recorrido
HTTP real de la colección se reserva para el gate limpio de HITO 20.

## Verificación final HITO 20 — 2026-09-04

La verificación partió del commit `a37365b` mediante `git archive`, sin `.git`,
`node_modules` ni `dist`, y con un volumen MySQL nuevo expresamente autorizado.

- la base comenzó con 0 migraciones ejecutadas y 14 pendientes; aplicó las 14
  y terminó sin pendientes;
- `npm ci` frontend instaló 246 paquetes y reportó cero vulnerabilidades;
- el primer `npm ci` backend instaló sus módulos pero quedó esperando la
  auditoría remota; se interrumpió sólo ese proceso temporal y
  `npm ci --no-audit` volvió a limpiar/instalar 281 paquetes desde el lockfile
  en 2 s;
- seed ADMIN: primera ejecución creó uno y la segunda no duplicó;
- seed demo: primera ejecución creó 20 clientes, 30 motos, 96 órdenes,
  192 ítems, 376 filas de historial y 3 mecánicos; la segunda no cambió datos;
- backend limpio: 28/28 suites y 342/342 pruebas en 254.44 s; lint pass;
- frontend limpio: 15/15 suites y 104/104 pruebas en 10.01 s; lint pass;
- build: 129 módulos, JS 400.02 kB (117.01 kB gzip); preview devolvió 200 en
  `/` y en una ruta SPA profunda;
- matriz de aceptación: 235 IDs únicos, todos `PASS`;
- Postman: JSON/scripts válidos, secretos vacíos, 7 carpetas, 36 requests,
  33/33 patrones y smoke real de health/login desde sus definiciones.
- auditoría SQL posterior al recorrido: cero motos con más de una orden abierta,
  asignaciones abiertas inválidas, lifecycle inconsistente, totales desalineados
  o filas audit con nombres de campos sensibles.

El recorrido HTTP real comprobó ADMIN y MECANICO, ownership, una sola orden
abierta, asignación/reasignación, total exacto, los tres retrocesos, entrega,
protección de ítems cerrados, orden nueva por falla diferente, bloqueo de reopen
con otra abierta, garantía, lifecycle de usuarios, soft delete/restore, placa
reservada, history y audit sin secretos, refresh/replay/logout. Una primera
aserción del harness buscó `ITEM_ADDED` bajo `WORK_ORDER`; se corrigió a su
entidad contractual `WORK_ORDER_ITEM` y la inspección pasó sin cambiar producto
ni datos.

Al terminar el recorrido, se eliminó expresamente el volumen de verificación y
se reconstruyó el estado de presentación desde cero. El estado final contiene
sólo el ADMIN y el dataset oficial de los seeders: 4 usuarios, 20 clientes,
30 motos, 96 órdenes, 192 ítems, 376 filas de historial y 0 eventos de auditoría
manuales. Las 14 migraciones están ejecutadas, no hay pendientes y las consultas
de cierre reportan cero órdenes abiertas duplicadas por moto, responsables
abiertos inválidos o totales inconsistentes.

## Smoke de navegador y API

El smoke real complementa, no reemplaza, las suites. El recorrido probado fue ADMIN creando Client → Bike → dos WorkOrders → REPUESTO/MANO_OBRA → total → estados → historial → MECANICO; luego MECANICO leyendo, agregando ítem, usando transición permitida y comprobando restricciones/logout.

También se observaron envelopes 401/403/400/404/409/429. HITO 18 validó la
colección base con 5 carpetas/22 requests; HITO 19 la amplió y volvió a validar
como JSON con 7 carpetas/36 requests que cubren todas las rutas productizadas.

### Registro local HITO 13 — 2026-08-24

- backend al cierre de HITO 13: 14/14 suites, 192/192 pruebas;
- frontend: 10/10 suites, 46/46 pruebas;
- build: 113 módulos, JS 326.83 kB (102.39 kB gzip);
- lint de ambos paquetes: pass;
- vistas auditadas: login, listado, creación, detalle por ambos roles y usuarios;
- 375/768/desktop sin overflow documental;
- teclado, skip link, Enter/Space, focus visible y semántica revisados;
- cero controles sin label, botones sin tipo o timestamps ISO crudos;
- Web Storage vacío y consola sin errores/warnings de aplicación.

### Verificación desde entorno limpio HITO 14 — 2026-08-24

- copia temporal del working tree sin `.git`, `node_modules` ni `dist`;
- `npm ci` backend/frontend desde sus lockfiles: pass;
- base MySQL temporal aislada sobre el contenedor saludable existente;
- siete migraciones ejecutadas y cero pendientes;
- seed ADMIN ejecutado dos veces: creó una fila y luego informó que ya existía;
- backend `npm start` y frontend `npm run dev`: inicio correcto;
- `GET /api/health`: 200 y `status=ok`;
- login ADMIN: 200; `GET /api/work-orders` autenticado: 200 con página vacía válida;
- documento frontend: 200 y título correcto;
- base, procesos, copia y archivos temporales eliminados al terminar.

### Mejora opcional — seed demo

- backend: 15/15 suites, 199/199 pruebas;
- dataset esperado: 3 mecánicos, 20 clientes, 30 motocicletas, 96 órdenes, 192 ítems y 376 eventos;
- distribución compatible con una sola orden abierta por moto: 5 en cada estado abierto y 38 en cada estado terminal;
- ejecución bloqueada en producción e idempotencia verificada;
- la matriz crítica de Fases 1 y 2 permanece en 103 casos PASS; esta suite cubre una facilidad opcional de evaluación.

El contenedor activo exponía MySQL en el puerto host 33306; el flujo documentado usa 3306 por defecto y permite ajustar `DB_PORT`. Como la base temporal no era una de las dos bases creadas originalmente por Compose, se le concedió al usuario local acceso únicamente durante esta comprobación; un Compose desde cero crea y concede `DB_NAME`/`DB_NAME_TEST` mediante su configuración e init script.

## Aislamiento posterior

Los perfiles/servidores temporales se eliminan o detienen. Los fixtures se mantienen en `pavas_workshop_test`; después del smoke, el esquema quedó reaplicado con siete migraciones, cero pendientes y siete tablas de entidad vacías.

## Limitaciones de pruebas

- Component tests mockean módulos API; el browser smoke cubre wiring sin añadir dependencia E2E permanente.
- El rate limiter local supone proceso fresco.
- Concurrencia demuestra orden transaccional en MySQL de evaluación, no throughput.
- 9.40 ms no es SLA productivo.
- No se instaló plugin de coverage: porcentaje no prueba aceptación funcional.
