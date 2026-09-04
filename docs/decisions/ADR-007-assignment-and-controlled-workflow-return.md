# ADR-007: Responsable único y retornos controlados del workflow

## Estado

Aprobado — 2026-09-03.

## Contexto

Los roles actuales son globales: no existe responsable por orden y un mecánico puede operar trabajo ajeno. La máquina de estados sólo avanza, aunque durante reparación pueden aparecer fallas adicionales, una prueba final puede fallar y una moto entregada puede regresar por garantía.

ADR-003 describe la máquina original. La asignación (HITO 7), el ownership
(HITO 9), las regresiones genéricas (HITO 10) y la reapertura dedicada
(HITO 11) materializan esta decisión.

## Decisión

### Responsable

`work_orders.assigned_mechanic_id` representa cero o un responsable. Sólo un usuario activo con rol `MECANICO` es válido. ADMIN puede asignar, reasignar o devolver una orden abierta a unassigned. Reassignment/unassignment requieren razón y audit; una asignación incluida al crear forma parte del evento CREATED.

MECANICO consulta y muta solamente órdenes propias. Puede agregar ítems y realizar transiciones intermedias permitidas. No crea órdenes/maestras, no asigna, no elimina ítems, no cancela, no entrega y no reabre.

### Regresiones genéricas

Con reason obligatorio:

```text
EN_PROCESO → DIAGNOSTICO
LISTA → DIAGNOSTICO
LISTA → EN_PROCESO
```

La primera cubre una falla adicional durante reparación; las otras cubren pruebas finales fallidas. Permanecen prohibidos los retrocesos a RECIBIDA y cualquier salida de CANCELADA.

### Reopen

`ENTREGADA → DIAGNOSTICO` sólo existe mediante
`POST /api/work-orders/:id/reopen`, para `WARRANTY` o `SAME_ISSUE`, con
reason, ADMIN, recursos activos y ninguna orden abierta competidora. Una falla
diferente crea una nueva orden.

El servicio bloquea `Client → Bike → WorkOrder`, revalida lifecycle, estado y
ausencia de otra orden abierta. History y audit se escriben en la misma
transacción. Cada reapertura vive como evento; no se agrega un campo de “última
reapertura” que perdería repeticiones. La UI la presenta como panel separado
sólo a `ADMIN`, con motivo obligatorio, confirmación y errores del backend.

### Ítems y usuarios

Una orden cerrada no admite mutaciones de ítems. Reopen vuelve a habilitarlas
según rol. No se implementa update de ítem. No se puede desactivar/quitar rol a
un mecánico con órdenes abiertas ni perder el último ADMIN activo. Las
operaciones que reducen ADMIN bloquean y cuentan todos los ADMIN activos para
que dos cambios concurrentes tampoco violen esa invariancia.

## Alternativas consideradas

- **Muchos mecánicos por orden:** fuera de la necesidad del evaluador y complica ownership.
- **Asignación obligatoria al crear:** descartada porque recepción puede quedar temporalmente sin responsable.
- **Permisos sólo en UI:** descartados porque el backend es la frontera.
- **Permitir cualquier retroceso:** descartado porque destruye semántica y auditabilidad.
- **Reabrir con status PATCH:** descartado porque no exige garantía/misma falla ni protege una orden abierta.
- **Nueva orden para toda garantía:** fragmenta el caso original y dificulta demostrar continuidad.
- **Editar ítems cerrados:** altera evidencia financiera/histórica.

## Consecuencias

- aparece una cola explícita de unassigned;
- los filtros y el dashboard dependen del actor;
- assignment y user lifecycle necesitan locks compatibles;
- razones de regresión/reopen quedan visibles en history y audit;
- el grafo deja de ser estrictamente lineal, pero sigue siendo explícito y exhaustivamente testeable;
- la demo puede mostrar reparación, hallazgo adicional, prueba fallida, entrega y garantía sin saltos arbitrarios.
