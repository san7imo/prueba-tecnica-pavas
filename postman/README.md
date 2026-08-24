# Postman

Import `PAVAS-Moto-Workshop.postman_collection.json`. Set collection variables `adminEmail` and `adminPassword` to the local seeded ADMIN; no credential is included in Git. Bearer `{{accessToken}}` is configured collection-wide for protected requests. Run Auth in this order:

1. Auth / Login (captures `accessToken` and Postman's cookie jar captures the HttpOnly refresh cookie)
2. Auth / Me
3. Auth / Refresh (rotates the cookie and replaces `accessToken`)
4. Auth / Register User (stores `managedUserId`)

Then run Users while still logged in as ADMIN:

1. Users / List Users
2. Users / Change User Role (`managedUserRole` is `ADMIN` or `MECANICO`)
3. Users / Change User Active (`managedUserActive` is a JSON boolean)

Then run protected Phase 1 requests in folder order:

1. Clients / Create client
2. Clients / Search clients
3. Clients / Get client
4. Bikes / Create bike
5. Bikes / Search bikes
6. Bikes / Get bike
7. Work Orders / Create Work Order
8. Work Orders / Add Work Order Item
9. Work Orders / List Work Orders
10. Work Orders / Filter Work Orders
11. Work Orders / Get Work Order
12. Work Orders / Update Work Order Status
13. Work Orders / Delete Work Order Item

The collection defaults `baseUrl` to `http://localhost:3000/api`. Create requests capture `clientId`, `bikeId`, the normalized `bikePlate`, `workOrderId` and `itemId` for later requests. Item tests verify exact totals. `toStatus` defaults to `DIAGNOSTICO`; change it to each next legal target (`EN_PROCESO`, `LISTA`, `ENTREGADA`) or use `CANCELADA` from a non-terminal order.

Run Auth / Logout last. HITO 8 Auth, Users and protected Phase 1 endpoints are present. History remains deliberately absent until HITO 9.
