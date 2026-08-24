# Postman

Import `PAVAS-Moto-Workshop.postman_collection.json` and run requests in folder order:

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

All Phase 1 endpoints are present. Authentication, history and other Phase 2 modules will be added only when implemented.
