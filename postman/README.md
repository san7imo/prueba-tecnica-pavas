# Guía de Postman

Importe `PAVAS-Moto-Workshop.postman_collection.json`. La colección contiene
7 carpetas y 36 requests que cubren todas las rutas públicas y protegidas del
producto.

## Configuración

Antes de comenzar defina:

- `adminEmail`: email del `ADMIN` creado por el seed;
- `adminPassword`: contraseña local del seed; nunca se incluye en el archivo;
- `baseUrl`: `http://localhost:3000/api` por defecto.

La colección aplica `Bearer {{accessToken}}` a las rutas protegidas. Login
captura el access token automáticamente y el cookie jar de Postman conserva la
cookie `HttpOnly` de refresh. Health, login, refresh y logout declaran `noauth`.

Las requests de alta generan cédula, email, teléfono y placa únicos y capturan
`managedUserId`, `mechanicId`, `clientId`, `clientDocumentNumber`, `bikeId`,
`bikePlate`, `workOrderId` e `itemId`. La consulta de auditoría captura
`auditEventId`. No exporte la
colección después de llenar contraseñas o tokens.

## Recorrido principal reproducible

Ejecute en este orden sobre una base nueva:

1. Salud / `Comprobar API`.
2. Autenticación / `Iniciar sesión`.
3. Autenticación / `Consultar usuario actual`.
4. Autenticación / `Registrar usuario`; crea un `MECANICO` único y guarda sus
   IDs.
5. Usuarios / `Listar usuarios`.
6. Clientes / `Crear cliente`, `Buscar clientes`, `Consultar cliente` y
   `Actualizar cliente`.
7. Motocicletas / `Crear motocicleta`, `Buscar motocicletas`,
   `Buscar por prefijo y propietario`, `Consultar motocicleta` y
   `Actualizar motocicleta`.
8. Órdenes de trabajo / `Crear orden de trabajo`.
9. Órdenes de trabajo / `Asignar responsable`.
10. Órdenes de trabajo / `Agregar ítem`, `Consultar orden` y
    `Consultar historial`.
11. Órdenes de trabajo / `Cambiar estado`, modificando `toStatus` en cada paso:
    `DIAGNOSTICO`, `EN_PROCESO`, `LISTA`, `ENTREGADA`.
12. Auditoría / `Listar eventos` y `Consultar evento`.
13. Autenticación / `Renovar sesión` para comprobar rotación.
14. Autenticación / `Cerrar sesión` sólo al terminar.

No ejecute `Eliminar ítem` después de entregar: las órdenes cerradas protegen
sus ítems. Si desea demostrar delete y recálculo a `0.00`, úselo mientras la
orden siga abierta y vuelva a crear un ítem antes de continuar.

## Variantes de producto

### Asignación y ownership

`Asignar responsable` acepta `mechanicId` positivo o `null`. Una primera
asignación puede omitir la razón; reasignar o dejar sin responsable exige
`assignmentReason`. Para probar **Mis órdenes**, inicie sesión en otra pestaña o
entorno como el mecánico creado y use:

```text
GET {{baseUrl}}/work-orders?scope=mine&page=1&pageSize=20
```

Ese token sólo podrá leer y operar la orden asignada. Con el token ADMIN,
`Listar órdenes sin asignar` demuestra la cola `scope=unassigned`.

### Retroceso controlado

Desde `EN_PROCESO`, configure `toStatus=DIAGNOSTICO`; desde `LISTA`, use
`DIAGNOSTICO` o `EN_PROCESO`. `Cambiar estado` ya envía una nota no vacía. Un
retroceso arbitrario o sin motivo debe responder 400 y no crear history/audit.

### Garantía o misma falla

Después de llegar a `ENTREGADA`, ejecute `Reabrir por garantía o misma falla`.
`reopenType` admite exclusivamente `WARRANTY` o `SAME_ISSUE`; `reopenReason` es
obligatorio. La respuesta debe quedar en `DIAGNOSTICO`, conservando ítems,
total y responsable. Para una falla distinta, cierre la orden y cree otra; no
existe `OTHER`.

### Soft delete y restore

Las requests `Archivar`/`Restaurar` exigen `mutationReason`.

- Una moto con orden abierta no se puede archivar. Cierre la orden antes.
- Un cliente con motos activas no se puede archivar. Archive primero todas sus
  motos y luego el cliente.
- Cambie `lifecycle` a `deleted` o `all` para comprobar vistas administrativas.
- Restore preserva relaciones e historia y no restaura recursos subordinados.

Para `Cambiar propietario`, cree o elija otro cliente activo y copie su ID a
`newOwnerClientId`. La operación conserva `bikeId` e historial y queda
auditada con la razón.

### Lifecycle de usuarios

`managedUserRole`, `managedUserActive` y `mutationReason` controlan las dos
requests de usuario. Un mecánico con órdenes abiertas no puede desactivarse ni
pasar a `ADMIN`; reasigne o cierre primero. El último `ADMIN` activo tampoco
puede desactivarse o degradarse. No cambie el rol del usuario guardado en
`mechanicId` antes de utilizarlo como responsable.

## Conflictos esperados

Los rechazos de negocio usan envelopes estables. Entre los más útiles para la
demostración:

- `CLIENT_DUPLICATE_RISK` / `CLIENT_RESTORE_REQUIRED`;
- `BIKE_PLATE_ALREADY_EXISTS` / `BIKE_RESTORE_REQUIRED`;
- `BIKE_HAS_ACTIVE_WORK_ORDER`;
- `ASSIGNEE_MUST_BE_MECHANIC` / `MECHANIC_INACTIVE`;
- `WORK_ORDER_NOT_ASSIGNED_TO_ACTOR` / `WORK_ORDER_CLOSED`;
- `STATUS_REGRESSION_REASON_REQUIRED` / `INVALID_STATUS_TRANSITION`;
- `LAST_ACTIVE_ADMIN_REQUIRED` / `MECHANIC_HAS_OPEN_ORDERS`.

Las pruebas de scripts esperan éxito en el recorrido indicado. Una request usada
intencionalmente para provocar un conflicto mostrará el 4xx correcto, pero su
test de status exitoso fallará: ese fallo es esperado en la variante negativa.
