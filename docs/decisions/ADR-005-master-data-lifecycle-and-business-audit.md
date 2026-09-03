# ADR-005: Lifecycle de maestras y auditoría empresarial

## Estado

Aprobado — 2026-09-03.

## Contexto

El MVP permite crear y consultar clientes/motos, pero no administrarlos como maestras completas. Un borrado físico rompería relaciones históricas y la creación rápida actual puede fomentar duplicados. El historial de estados sólo explica transiciones de órdenes; no responde quién editó, eliminó, restauró o cambió propietario.

## Decisión

### Lifecycle explícito

Clientes y motos incorporan `deleted_at`, `deleted_by_user_id` y `delete_reason`. Se usa filtrado explícito en repositories, no Sequelize paranoid, porque el producto necesita:

- vistas active/deleted/all;
- actor y razón en el estado actual;
- restauración controlada;
- reglas distintas por entidad;
- queries administrativas deliberadas.

Los tres campos están todos nulos o todos informados. Restaurar los limpia y el audit preserva la evidencia.

Un cliente con motos activas no puede eliminarse. Una moto con orden abierta no puede eliminarse. Restaurar una moto requiere propietario activo. No hay cascadas. La placa continúa globalmente única mientras la moto esté eliminada.

### Riesgo de duplicado

Nombre no es único. Teléfono/email se normalizan y se buscan por igualdad exacta. Coincidencia activa produce conflicto y permite override explícito con razón cuando se confirma que son personas distintas. Coincidencia eliminada exige restaurar el registro existente. No se crean UNIQUE de contacto porque familias o empresas pueden compartirlos.

Restore vuelve a evaluar el riesgo frente a clientes activos y exige el mismo
override explícito cuando corresponda. Un cliente o una moto eliminados se
consultan para administración, pero no se editan ni cambian de propietario hasta
restaurarlos.

### Auditoría

Se agrega `audit_events` append-only con actor autenticado, entidad, acción,
snapshots allowlisted, metadata allowlisted, reason y fecha. No tiene API de
mutación. `work_order_status_history` permanece como ledger especializado; no
se reemplaza. Migraciones, seeds y bootstrap sin sesión autenticada no inventan
un actor empresarial; las mutaciones normales de producto sí lo exigen.

## Alternativas consideradas

- **Hard delete:** descartado porque destruye relaciones e historia.
- **Cascade delete:** descartado porque puede borrar evidencia del taller.
- **Sequelize paranoid:** oculta filtros por defecto y no modela actor/razón/restauración con la claridad requerida.
- **UNIQUE en teléfono/email:** descartado porque un contacto compartido es legítimo.
- **Auditar modelos completos:** descartado por mass disclosure y riesgo de contraseñas/tokens.
- **Reemplazar status history:** descartado porque perdería un ledger especializado ya probado.

## Consecuencias

- todas las consultas operativas deben filtrar lifecycle explícitamente;
- los flows de delete/restore son transaccionales y requieren razón;
- más filas históricas se conservan deliberadamente;
- snapshots deben mantenerse mediante allowlists al evolucionar entidades;
- el acceso de auditoría queda limitado a ADMIN;
- la placa eliminada se recupera restaurando, no creando otra identidad.
