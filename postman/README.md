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
12. Work Orders / Delete Work Order Item

The collection defaults `baseUrl` to `http://localhost:3000/api`. Create requests capture `clientId`, `bikeId`, the normalized `bikePlate`, `workOrderId` and `itemId` for later requests. Item tests verify the exact recalculated total after creation and deletion.

Only endpoints implemented through HITO 4 are present. Status changes, authentication, history and other future modules will be added when implemented.
