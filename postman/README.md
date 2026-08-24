# Postman

Import `PAVAS-Moto-Workshop.postman_collection.json` and run requests in folder order:

1. Clients / Create client
2. Clients / Search clients
3. Clients / Get client
4. Bikes / Create bike
5. Bikes / Search bikes
6. Bikes / Get bike
7. Work Orders / Create Work Order
8. Work Orders / List Work Orders
9. Work Orders / Filter Work Orders
10. Work Orders / Get Work Order

The collection defaults `baseUrl` to `http://localhost:3000/api`. Create requests capture `clientId`, `bikeId`, the normalized `bikePlate` and `workOrderId` for later requests. Simple tests verify status codes and expected response fields.

Only endpoints implemented through HITO 3 are present. Items, status changes, authentication, history and other future modules will be added when implemented.
