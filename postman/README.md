# Guía de Postman

Importe `PAVAS-Moto-Workshop.postman_collection.json`. La colección contiene 5 carpetas y 22 requests, con `baseUrl=http://localhost:3000/api` por defecto.

## Configuración

Defina estas variables de colección antes de comenzar:

- `adminEmail`: email del ADMIN creado con el seed;
- `adminPassword`: contraseña local del seed; la colección no incluye una;
- `baseUrl`: URL base de la API si no usa el valor local.

`{{accessToken}}` está configurado como Bearer para las rutas protegidas. La request de login captura el access token automáticamente; el cookie jar de Postman conserva la cookie `HttpOnly` de refresh.

## Orden recomendado

### Auth

1. `Iniciar sesión` — captura `accessToken` y cookie.
2. `Consultar usuario actual`.
3. `Renovar sesión` — rota cookie y reemplaza access token.
4. `Registrar usuario` — guarda `managedUserId`.

### Usuarios

Mantenga la sesión `ADMIN`:

1. `Listar usuarios`.
2. `Cambiar rol de usuario` — `managedUserRole` acepta `ADMIN` o `MECANICO`.
3. `Cambiar estado activo` — `managedUserActive` debe ser boolean JSON.

### Flujo de negocio

1. Clientes / `Crear cliente`.
2. Clientes / `Buscar clientes`.
3. Clientes / `Consultar cliente`.
4. Motocicletas / `Crear motocicleta`.
5. Motocicletas / `Buscar motocicletas`.
6. Motocicletas / `Consultar motocicleta`.
7. Órdenes de trabajo / `Crear orden de trabajo`.
8. Órdenes de trabajo / `Agregar ítem`.
9. Órdenes de trabajo / `Listar órdenes`.
10. Órdenes de trabajo / `Filtrar órdenes`.
11. Órdenes de trabajo / `Consultar orden`.
12. Órdenes de trabajo / `Cambiar estado`.
13. Órdenes de trabajo / `Consultar historial`.
14. Órdenes de trabajo / `Eliminar ítem`.

Las requests de creación capturan `clientId`, `bikeId`, `bikePlate`, `workOrderId` e `itemId`. Los scripts de ítems verifican totales exactos. `toStatus` inicia en `DIAGNOSTICO`; cámbielo siguiendo `EN_PROCESO`, `LISTA`, `ENTREGADA`, o use `CANCELADA` desde una orden no terminal.

Ejecute Auth / `Cerrar sesión` al final. No versione valores reales de `adminPassword` ni tokens exportados.
