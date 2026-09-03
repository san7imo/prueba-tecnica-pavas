import { clientService } from '../services/clientService.js';
import { serializeClient } from '../utils/resourceSerializers.js';

export const createClient = async (request, response) => {
  const client = await clientService.createClient(
    request.validated.body,
    request.user,
  );
  response.status(201).json({ data: serializeClient(client) });
};

export const listClients = async (request, response) => {
  const clients = await clientService.listClients(request.validated.query.search);
  response.json({ data: clients.map(serializeClient) });
};

export const getClient = async (request, response) => {
  const client = await clientService.getClient(request.validated.params.id);
  response.json({ data: serializeClient(client) });
};
