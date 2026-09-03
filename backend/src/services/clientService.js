import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { CLIENT_DUPLICATE_FIELD, CLIENT_LIFECYCLE } from '../constants/client.js';
import { USER_ROLE } from '../constants/auth.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { normalizeClientPhoneSearch } from '../utils/clientContacts.js';
import { auditService } from './auditService.js';

const clientNotFound = () =>
  new NotFoundError({
    code: 'CLIENT_NOT_FOUND',
    message: 'Client not found.',
  });

const lifecycleConflict = (code, message) => new ConflictError({ code, message });

const duplicateConflict = (code, message, details) =>
  new ConflictError({ code, message, details });

const plain = (resource) =>
  typeof resource?.get === 'function' ? resource.get({ plain: true }) : resource;

const detachedPlain = (resource) => structuredClone(plain(resource));

const compareIds = (left, right) => {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
};

const matchDetails = (candidates, contacts) => {
  const matchedFields = new Set();
  for (const candidate of candidates) {
    if (contacts.phone && candidate.phone === contacts.phone) {
      matchedFields.add(CLIENT_DUPLICATE_FIELD.PHONE);
    }
    if (contacts.email && candidate.email === contacts.email) {
      matchedFields.add(CLIENT_DUPLICATE_FIELD.EMAIL);
    }
  }
  return {
    candidateIds: candidates.map(({ id }) => String(id)).sort(compareIds),
    matchedFields: [...matchedFields].sort(),
  };
};

const evaluateDuplicateRisk = async (
  {
    contacts,
    excludeId,
    confirmDuplicate,
    blockDeletedMatches,
  },
  transaction,
) => {
  const candidates = (
    await clientRepository.findDuplicateCandidates(
      { ...contacts, excludeId },
      transaction,
    )
  ).map(plain);
  const activeCandidates = candidates.filter(({ deletedAt }) => deletedAt === null);
  const deletedCandidates = candidates.filter(({ deletedAt }) => deletedAt !== null);

  if (blockDeletedMatches && deletedCandidates.length > 0) {
    throw duplicateConflict(
      'CLIENT_RESTORE_REQUIRED',
      'A deleted client already uses this contact data and must be restored.',
      matchDetails(deletedCandidates, contacts),
    );
  }
  if (activeCandidates.length === 0) return null;

  const details = matchDetails(activeCandidates, contacts);
  if (!confirmDuplicate) {
    throw duplicateConflict(
      'CLIENT_DUPLICATE_RISK',
      'An active client already uses this contact data.',
      details,
    );
  }
  return {
    duplicateOverride: true,
    ...details,
  };
};

const changedClientFields = (client, updates) =>
  Object.keys(updates).filter((field) => client[field] !== updates[field]);

export const clientService = {
  createClient(data, actor) {
    return sequelize.transaction(async (transaction) => {
      const duplicateMetadata = await evaluateDuplicateRisk({
        contacts: { phone: data.phone, email: data.email },
        confirmDuplicate: data.confirmDuplicate,
        blockDeletedMatches: true,
      }, transaction);
      const client = await clientRepository.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
      }, { transaction });
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        action: AUDIT_ACTION.CREATED,
        actor,
        after: client,
        metadata: duplicateMetadata,
        reason: duplicateMetadata ? data.duplicateReason : null,
      }, transaction);
      return client;
    });
  },

  async listClients(filters, actor) {
    if (
      actor.role !== USER_ROLE.ADMIN &&
      filters.lifecycle !== CLIENT_LIFECYCLE.ACTIVE
    ) {
      throw new AuthorizationError();
    }
    const search = filters.search?.trim();
    const { count, rows } = await clientRepository.findPaginated({
      ...filters,
      search,
      phoneSearch: search ? normalizeClientPhoneSearch(search) : undefined,
    });
    return {
      clients: rows,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / filters.pageSize),
      },
    };
  },

  async getClient(id, actor) {
    const client = await clientRepository.findById(id);
    if (!client) throw clientNotFound();
    if (client.deletedAt !== null && actor.role !== USER_ROLE.ADMIN) {
      throw new AuthorizationError();
    }
    return client;
  },

  updateClient(id, data, actor) {
    return sequelize.transaction(async (transaction) => {
      const client = await clientRepository.findByIdForUpdate(id, transaction);
      if (!client) throw clientNotFound();
      if (client.deletedAt !== null) {
        throw lifecycleConflict(
          'CLIENT_INACTIVE',
          'Deleted clients must be restored before they can be updated.',
        );
      }

      const changedFields = changedClientFields(client, data.updates);
      if (changedFields.length === 0) return client;
      const contactUpdates = {};
      if (changedFields.includes('phone')) contactUpdates.phone = data.updates.phone;
      if (changedFields.includes('email')) contactUpdates.email = data.updates.email;
      const duplicateMetadata = Object.keys(contactUpdates).length > 0
        ? await evaluateDuplicateRisk({
            contacts: contactUpdates,
            excludeId: client.id,
            confirmDuplicate: data.confirmDuplicate,
            blockDeletedMatches: true,
          }, transaction)
        : null;
      const before = detachedPlain(client);
      await clientRepository.update(client, data.updates, transaction);
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        action: AUDIT_ACTION.UPDATED,
        actor,
        before,
        after: client,
        metadata: {
          changedFields,
          ...(duplicateMetadata ?? {}),
        },
        reason: duplicateMetadata ? data.duplicateReason : null,
      }, transaction);
      return client;
    });
  },

  deleteClient(id, reason, actor) {
    return sequelize.transaction(async (transaction) => {
      const client = await clientRepository.findByIdForUpdate(id, transaction);
      if (!client) throw clientNotFound();
      if (client.deletedAt !== null) {
        throw lifecycleConflict(
          'CLIENT_ALREADY_DELETED',
          'Client is already deleted.',
        );
      }
      const activeBikes = await bikeRepository.findActiveByClientForUpdate(
        client.id,
        transaction,
      );
      if (activeBikes.length > 0) {
        throw lifecycleConflict(
          'CLIENT_HAS_ACTIVE_BIKES',
          'Client has active motorcycles that must be transferred or deleted first.',
        );
      }

      const before = detachedPlain(client);
      await clientRepository.updateLifecycle(client, {
        deletedAt: new Date(),
        deletedByUserId: actor.id,
        deleteReason: reason,
      }, transaction);
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        action: AUDIT_ACTION.SOFT_DELETED,
        actor,
        before,
        after: client,
        reason,
      }, transaction);
      return client;
    });
  },

  restoreClient(id, data, actor) {
    return sequelize.transaction(async (transaction) => {
      const client = await clientRepository.findByIdForUpdate(id, transaction);
      if (!client) throw clientNotFound();
      if (client.deletedAt === null) {
        throw lifecycleConflict(
          'CLIENT_NOT_DELETED',
          'Client is already active.',
        );
      }
      const duplicateMetadata = await evaluateDuplicateRisk({
        contacts: { phone: client.phone, email: client.email },
        excludeId: client.id,
        confirmDuplicate: data.confirmDuplicate,
        blockDeletedMatches: false,
      }, transaction);
      const before = detachedPlain(client);
      await clientRepository.updateLifecycle(client, {
        deletedAt: null,
        deletedByUserId: null,
        deleteReason: null,
      }, transaction);
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        action: AUDIT_ACTION.RESTORED,
        actor,
        before,
        after: client,
        metadata: duplicateMetadata
          ? { ...duplicateMetadata, duplicateReason: data.duplicateReason }
          : null,
        reason: data.reason,
      }, transaction);
      return client;
    });
  },
};
