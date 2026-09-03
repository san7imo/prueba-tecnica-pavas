import { clientService } from '../services/clientService.js';
import { serializeManagedClient } from '../utils/resourceSerializers.js';

export const createClient = async (request, response) => {
  const client = await clientService.createClient(
    request.validated.body,
    request.user,
  );
  response.status(201).json({ data: serializeManagedClient(client) });
};

export const listClients = async (request, response) => {
  const result = await clientService.listClients(
    request.validated.query,
    request.user,
  );
  response.json({
    data: result.clients.map(serializeManagedClient),
    meta: result.meta,
  });
};

export const getClient = async (request, response) => {
  const client = await clientService.getClient(
    request.validated.params.id,
    request.user,
  );
  response.json({ data: serializeManagedClient(client) });
};

export const updateClient = async (request, response) => {
  const client = await clientService.updateClient(
    request.validated.params.id,
    request.validated.body,
    request.user,
  );
  response.json({ data: serializeManagedClient(client) });
};

export const deleteClient = async (request, response) => {
  const client = await clientService.deleteClient(
    request.validated.params.id,
    request.validated.body.reason,
    request.user,
  );
  response.json({ data: serializeManagedClient(client) });
};

export const restoreClient = async (request, response) => {
  const client = await clientService.restoreClient(
    request.validated.params.id,
    request.validated.body,
    request.user,
  );
  response.json({ data: serializeManagedClient(client) });
};
