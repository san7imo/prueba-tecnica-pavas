# Postman

Import `PAVAS-Moto-Workshop.postman_collection.json` and run requests in folder order:

1. Clients / Create client
2. Clients / Search clients
3. Clients / Get client
4. Bikes / Create bike
5. Bikes / Search bikes
6. Bikes / Get bike

The collection defaults `baseUrl` to `http://localhost:3000/api`. Create requests capture `clientId`, `bikeId` and the normalized `bikePlate` for later requests. Simple tests verify status codes and expected response fields.

Only the real HITO 2 endpoints are present. Authentication, work orders and other future modules will be added when implemented.
