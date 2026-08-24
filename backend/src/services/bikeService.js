import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';

import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { normalizePlate } from '../utils/normalizePlate.js';

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
  async createBike(data) {
    const plate = normalizePlate(data.plate);
    const client = await clientRepository.findById(data.clientId);
    if (!client) {
      throw clientNotFound();
    }

    if (await bikeRepository.findByPlate(plate)) {
      throw plateConflict();
    }

    try {
      const bike = await bikeRepository.create({
        plate,
        brand: data.brand.trim(),
        model: data.model.trim(),
        cylinder: data.cylinder,
        clientId: data.clientId,
      });
      return bikeRepository.findById(bike.id);
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
