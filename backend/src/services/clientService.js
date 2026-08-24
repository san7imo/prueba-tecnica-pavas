import { NotFoundError } from '../errors/NotFoundError.js';
import { clientRepository } from '../repositories/clientRepository.js';

const clientNotFound = () =>
  new NotFoundError({
    code: 'CLIENT_NOT_FOUND',
    message: 'Client not found.',
  });

export const clientService = {
  createClient(data) {
    return clientRepository.create({
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email ? data.email.trim().toLowerCase() : null,
    });
  },

  listClients(search) {
    return clientRepository.search(search?.trim());
  },

  async getClient(id) {
    const client = await clientRepository.findById(id);
    if (!client) {
      throw clientNotFound();
    }
    return client;
  },
};
