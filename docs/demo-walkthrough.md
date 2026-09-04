# Recorrido de demostración

## Objetivo

Este guion presenta el sistema como producto de taller, no como una secuencia
aislada de endpoints. Parte de una base nueva, muestra el trabajo de `ADMIN` y
`MECANICO`, y termina con una devolución por garantía trazable.

Duración sugerida: 15–20 minutos. La interfaz web es el canal principal;
Postman queda disponible para enseñar contratos, errores y auditoría con mayor
detalle.

## Preparación desde cero

1. Cree los tres `.env` desde sus ejemplos y configure secretos distintos,
   credenciales MySQL y `ADMIN_SEED_*`.
2. Inicie MySQL con `docker compose up -d mysql` y espere el estado saludable.
3. En `backend`, ejecute `npm ci`, `npm run db:migrate`,
   `npm run db:migrate:status` y `npm run db:seed:admin`.
4. Opcionalmente ejecute `npm run db:seed:demo` para poblar las colas del
   dashboard. El seed es idempotente y exclusivo de desarrollo/evaluación.
5. Inicie API y frontend con `npm run dev` en cada paquete.
6. Compruebe `GET http://localhost:3000/api/health` y abra
   `http://localhost:5173`.

Antes de presentar, no deje contraseñas o tokens visibles en terminales,
Postman exportado ni archivos versionados.

## Historia principal

### 1. Recepción y reutilización de maestras — ADMIN

1. Inicie sesión como `ADMIN` y enseñe las colas reales del dashboard.
2. Abra **Nueva orden** y busque primero al cliente por nombre, teléfono o
   correo. Explique que el flujo favorece reutilizar registros.
3. Si el cliente no existe, créelo desde la rama subordinada. Intente reutilizar
   el mismo teléfono para mostrar el conflicto de duplicado y sus opciones
   seguras; no confirme el duplicado si se trata de la misma persona.
4. Seleccione una motocicleta activa del propietario o créela. Muestre que la
   placa se normaliza y que una colisión dirige al registro existente.
5. Registre la falla, elija un mecánico activo o deje la orden explícitamente
   sin asignar y cree la orden.

Resultado a remarcar: una orden `RECIBIDA`, total `0.00`, propietario y moto
relacionados, responsable explícito, history inicial y evento `CREATED`.

### 2. Asignación y trabajo técnico

1. Si la orden quedó sin responsable, ábrala desde **Sin asignar** y asígnela a
   un `MECANICO`.
2. Abra una sesión separada como ese mecánico. Su dashboard y **Mis órdenes**
   sólo deben consultar `scope=mine`.
3. Entre a la orden, avance a `DIAGNOSTICO` y agregue una mano de obra y un
   repuesto. Verifique actor de cada ítem y total exacto calculado por servidor.
4. Avance a `EN_PROCESO`. Desde aquí vuelva a `DIAGNOSTICO` con un motivo para
   representar una falla adicional descubierta durante la reparación.
5. Avance otra vez hasta `LISTA`. Ejecute uno de los retornos por prueba fallida
   (`LISTA → DIAGNOSTICO` o `LISTA → EN_PROCESO`) y enseñe que el motivo aparece
   en el timeline.

Resultado a remarcar: el mecánico sólo opera su orden; las regresiones no son
arbitrarias y history/audit conservan actor, transición y razón.

### 3. Entrega — ADMIN

1. Vuelva a la sesión `ADMIN`, abra la orden ya corregida y llévela a `LISTA`.
2. Entréguela. Compruebe que `ENTREGADA` no ofrece un avance genérico y que los
   ítems quedan visibles pero protegidos contra alta o eliminación.
3. En la motocicleta, enseñe la relación histórica y la ausencia de una orden
   abierta.

### 4. Regreso por garantía

1. En la orden entregada, use el panel dedicado de reapertura.
2. Elija `WARRANTY` o `SAME_ISSUE`, escriba una razón concreta y confirme.
3. Compruebe el regreso a `DIAGNOSTICO`, conservando responsable, ítems y total.
4. Agregue trabajo correctivo permitido y enseñe el evento `REOPENED` junto con
   el history `ENTREGADA → DIAGNOSTICO`.

Explique que una falla distinta no reabre esta orden: se crea una nueva cuando
no exista otra abierta para la motocicleta.

## Controles de producto que conviene mostrar

- Intentar crear una segunda orden abierta para la misma motocicleta: responde
  `BIKE_HAS_ACTIVE_WORK_ORDER` y enlaza al trabajo vigente.
- Reasignar una orden: el mecánico anterior pierde acceso inmediatamente y el
  nuevo lo obtiene; queda auditado el antes/después y la razón.
- Intentar desactivar un mecánico con trabajo abierto: el sistema exige
  reasignar primero y ofrece acceso a esa cola.
- Intentar desactivar/degradar al último `ADMIN`: responde
  `LAST_ACTIVE_ADMIN_REQUIRED`.
- Archivar/restaurar una moto sin orden abierta y luego su cliente: la historia
  permanece; los eliminados no aparecen en selección operacional.
- Consultar **Auditoría** como `ADMIN`: filtros, actor, razón y snapshots
  allowlisted; no existen acciones de edición o borrado.
- Intentar una URL administrativa como `MECANICO`: el backend responde 403 aun
  si se manipula la navegación.

## Cierre técnico breve

Al terminar, conecte cada demostración con su mecanismo:

- servicios y transacciones concentran reglas;
- locks e índice UNIQUE generado protegen concurrencia;
- MySQL `DECIMAL` y recálculo desde ítems protegen totales;
- `work_order_status_history` registra estados y `audit_events` registra el
  contexto empresarial;
- soft delete preserva relaciones;
- el frontend guía, pero la autoridad permanece en el backend.

La colección [Postman](../postman/README.md), la
[matriz de aceptación](test-acceptance-matrix.md) y los ADR permiten profundizar
sin interrumpir el recorrido principal.
