import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { BIKE_LIFECYCLE } from '../constants/bike.js';
import { USER_ROLE } from '../constants/auth.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { normalizePlate } from '../utils/normalizePlate.js';
import { auditService } from './auditService.js';

const clientNotFound = () =>
  new NotFoundError({
    code: 'CLIENT_NOT_FOUND',
    message: 'Client not found.',
  });

const bikeNotFound = () =>
  new NotFoundError({
    code: 'BIKE_NOT_FOUND',
    message: 'Bike not found.',
  });

const conflict = (code, message) => new ConflictError({ code, message });

const plateConflict = (bike) =>
  bike?.deletedAt !== null && bike?.deletedAt !== undefined
    ? conflict(
        'BIKE_RESTORE_REQUIRED',
        'A deleted bike already uses this plate and must be restored.',
      )
    : conflict(
        'BIKE_PLATE_ALREADY_EXISTS',
        'A bike with this plate already exists.',
      );

const bikeInactive = () =>
  conflict(
    'BIKE_INACTIVE',
    'Deleted motorcycles must be restored before they can be modified.',
  );

const concurrentModification = () =>
  conflict(
    'CONCURRENT_MODIFICATION_RETRY',
    'The motorcycle changed concurrently. Reload it and retry.',
  );

const isDatabaseConcurrencyError = (error) =>
  ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(
    error?.original?.code ?? error?.parent?.code,
  );

const plain = (resource) =>
  typeof resource?.get === 'function' ? resource.get({ plain: true }) : resource;

const detachedPlain = (resource) => structuredClone(plain(resource));

const changedBikeFields = (bike, updates) =>
  Object.keys(updates).filter((field) => bike[field] !== updates[field]);

const indexedClients = (clients) =>
  new Map(clients.map((client) => [String(client.id), client]));

const exactPlateConflict = async (plate) => {
  const persisted = await bikeRepository.findByPlate(plate);
  return plateConflict(persisted);
};

const translateConcurrency = (error) => {
  if (isDatabaseConcurrencyError(error)) throw concurrentModification();
  throw error;
};

export const bikeService = {
  async createBike(data, actor) {
    const plate = normalizePlate(data.plate);

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        const client = await clientRepository.findByIdForUpdate(
          data.clientId,
          transaction,
        );
        if (!client) throw clientNotFound();
        if (client.deletedAt !== null) {
          throw conflict(
            'CLIENT_INACTIVE',
            'Deleted clients cannot receive new motorcycles.',
          );
        }

        const existingBike = await bikeRepository.findByPlate(plate, {
          transaction,
        });
        if (existingBike) throw plateConflict(existingBike);

        const bike = await bikeRepository.create({
          plate,
          brand: data.brand,
          model: data.model,
          cylinder: data.cylinder,
          clientId: data.clientId,
        }, { transaction });
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.BIKE,
          action: AUDIT_ACTION.CREATED,
          actor,
          after: bike,
        }, transaction);
        return bike.id;
      });
      return bikeRepository.findById(bikeId);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw await exactPlateConflict(plate);
      }
      if (error instanceof ForeignKeyConstraintError) throw clientNotFound();
      return translateConcurrency(error);
    }
  },

  async listBikes(filters, actor) {
    if (
      actor.role !== USER_ROLE.ADMIN &&
      filters.lifecycle !== BIKE_LIFECYCLE.ACTIVE
    ) {
      throw new AuthorizationError();
    }
    const { count, rows } = await bikeRepository.findPaginated(filters);
    return {
      bikes: rows,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / filters.pageSize),
      },
    };
  },

  async getBike(id, actor) {
    const bike = await bikeRepository.findById(id);
    if (!bike) throw bikeNotFound();
    if (bike.deletedAt !== null && actor.role !== USER_ROLE.ADMIN) {
      throw new AuthorizationError();
    }
    const currentOpenOrder = await workOrderRepository.findCurrentOpenByBikeId(id);
    return { bike, currentOpenOrder };
  },

  async updateBike(id, updates, actor) {
    const normalizedUpdates = {
      ...updates,
      ...(updates.plate === undefined
        ? {}
        : { plate: normalizePlate(updates.plate) }),
    };

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        const bike = await bikeRepository.findByIdForUpdate(id, transaction);
        if (!bike) throw bikeNotFound();
        if (bike.deletedAt !== null) throw bikeInactive();

        const changedFields = changedBikeFields(bike, normalizedUpdates);
        if (changedFields.length === 0) return bike.id;
        if (changedFields.includes('plate')) {
          const existingBike = await bikeRepository.findByPlate(
            normalizedUpdates.plate,
            { transaction },
          );
          if (existingBike) throw plateConflict(existingBike);
        }

        const before = detachedPlain(bike);
        await bikeRepository.update(bike, normalizedUpdates, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.BIKE,
          action: AUDIT_ACTION.UPDATED,
          actor,
          before,
          after: bike,
          metadata: { changedFields },
        }, transaction);
        return bike.id;
      });
      return bikeRepository.findById(bikeId);
    } catch (error) {
      if (error instanceof UniqueConstraintError && normalizedUpdates.plate) {
        throw await exactPlateConflict(normalizedUpdates.plate);
      }
      return translateConcurrency(error);
    }
  },

  async changeOwner(id, { clientId, reason }, actor) {
    const identity = await bikeRepository.findIdentityById(id);
    if (!identity) throw bikeNotFound();

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        const clients = indexedClients(await clientRepository.findByIdsForUpdate(
          [...new Set([String(identity.clientId), String(clientId)])],
          transaction,
        ));
        const originalOwner = clients.get(String(identity.clientId));
        const destinationOwner = clients.get(String(clientId));
        if (!destinationOwner) throw clientNotFound();

        const bike = await bikeRepository.findByIdForUpdate(id, transaction);
        if (!bike) throw bikeNotFound();
        if (String(bike.clientId) !== String(identity.clientId)) {
          throw concurrentModification();
        }
        if (bike.deletedAt !== null) throw bikeInactive();
        if (!originalOwner || originalOwner.deletedAt !== null) {
          throw conflict(
            'BIKE_OWNER_INACTIVE',
            'The motorcycle owner must be active.',
          );
        }
        if (destinationOwner.deletedAt !== null) {
          throw conflict(
            'CLIENT_INACTIVE',
            'Deleted clients cannot own an active motorcycle.',
          );
        }
        if (String(bike.clientId) === String(clientId)) return bike.id;

        const before = detachedPlain(bike);
        await bikeRepository.updateOwner(bike, clientId, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.BIKE,
          action: AUDIT_ACTION.OWNER_CHANGED,
          actor,
          before,
          after: bike,
          metadata: {
            previousClientId: identity.clientId,
            newClientId: clientId,
          },
          reason,
        }, transaction);
        return bike.id;
      });
      return bikeRepository.findById(bikeId);
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) throw clientNotFound();
      return translateConcurrency(error);
    }
  },

  async deleteBike(id, reason, actor) {
    const identity = await bikeRepository.findIdentityById(id);
    if (!identity) throw bikeNotFound();

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        await clientRepository.findByIdsForUpdate(
          [String(identity.clientId)],
          transaction,
        );
        const bike = await bikeRepository.findByIdForUpdate(id, transaction);
        if (!bike) throw bikeNotFound();
        if (String(bike.clientId) !== String(identity.clientId)) {
          throw concurrentModification();
        }
        if (bike.deletedAt !== null) {
          throw conflict(
            'BIKE_ALREADY_DELETED',
            'Motorcycle is already deleted.',
          );
        }
        const openOrders = await workOrderRepository.findOpenByBikeIdForUpdate(
          bike.id,
          transaction,
        );
        if (openOrders.length > 0) {
          throw conflict(
            'BIKE_HAS_ACTIVE_WORK_ORDER',
            'Motorcycle has an open work order and cannot be deleted.',
          );
        }

        const before = detachedPlain(bike);
        await bikeRepository.updateLifecycle(bike, {
          deletedAt: new Date(),
          deletedByUserId: actor.id,
          deleteReason: reason,
        }, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.BIKE,
          action: AUDIT_ACTION.SOFT_DELETED,
          actor,
          before,
          after: bike,
          reason,
        }, transaction);
        return bike.id;
      });
      return bikeRepository.findById(bikeId);
    } catch (error) {
      return translateConcurrency(error);
    }
  },

  async restoreBike(id, reason, actor) {
    const identity = await bikeRepository.findIdentityById(id);
    if (!identity) throw bikeNotFound();

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        const owner = await clientRepository.findByIdForUpdate(
          identity.clientId,
          transaction,
        );
        const bike = await bikeRepository.findByIdForUpdate(id, transaction);
        if (!bike) throw bikeNotFound();
        if (String(bike.clientId) !== String(identity.clientId)) {
          throw concurrentModification();
        }
        if (bike.deletedAt === null) {
          throw conflict(
            'BIKE_NOT_DELETED',
            'Motorcycle is already active.',
          );
        }
        if (!owner || owner.deletedAt !== null) {
          throw conflict(
            'BIKE_OWNER_INACTIVE',
            'The motorcycle owner must be active before restoration.',
          );
        }

        const before = detachedPlain(bike);
        await bikeRepository.updateLifecycle(bike, {
          deletedAt: null,
          deletedByUserId: null,
          deleteReason: null,
        }, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.BIKE,
          action: AUDIT_ACTION.RESTORED,
          actor,
          before,
          after: bike,
          reason,
        }, transaction);
        return bike.id;
      });
      return bikeRepository.findById(bikeId);
    } catch (error) {
      return translateConcurrency(error);
    }
  },
};
