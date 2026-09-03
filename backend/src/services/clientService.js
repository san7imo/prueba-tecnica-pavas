import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { auditService } from './auditService.js';

const clientNotFound = () =>
  new NotFoundError({
    code: 'CLIENT_NOT_FOUND',
    message: 'Client not found.',
  });

export const clientService = {
  createClient(data, actor) {
    return sequelize.transaction(async (transaction) => {
      const client = await clientRepository.create({
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email ? data.email.trim().toLowerCase() : null,
      }, { transaction });
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        action: AUDIT_ACTION.CREATED,
        actor,
        after: client,
      }, transaction);
      return client;
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
