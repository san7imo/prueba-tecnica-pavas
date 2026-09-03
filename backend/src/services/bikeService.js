import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
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

const plateConflict = () =>
  new ConflictError({
    code: 'BIKE_PLATE_ALREADY_EXISTS',
    message: 'A bike with this plate already exists.',
  });

export const bikeService = {
  async createBike(data, actor) {
    const plate = normalizePlate(data.plate);

    try {
      const bikeId = await sequelize.transaction(async (transaction) => {
        const options = { transaction };
        const client = await clientRepository.findByIdForUpdate(
          data.clientId,
          transaction,
        );
        if (!client) throw clientNotFound();
        if (client.deletedAt !== null) {
          throw new ConflictError({
            code: 'CLIENT_INACTIVE',
            message: 'Deleted clients cannot receive new motorcycles.',
          });
        }
        if (await bikeRepository.findByPlate(plate, options)) {
          throw plateConflict();
        }

        const bike = await bikeRepository.create({
          plate,
          brand: data.brand.trim(),
          model: data.model.trim(),
          cylinder: data.cylinder,
          clientId: data.clientId,
        }, options);
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
        throw plateConflict();
      }
      if (error instanceof ForeignKeyConstraintError) {
        throw clientNotFound();
      }
      throw error;
    }
  },

  listBikes(plate) {
    return bikeRepository.searchByPlate(plate ? normalizePlate(plate) : undefined);
  },

  async getBike(id) {
    const bike = await bikeRepository.findById(id);
    if (!bike) {
      throw bikeNotFound();
    }
    return bike;
  },
};
