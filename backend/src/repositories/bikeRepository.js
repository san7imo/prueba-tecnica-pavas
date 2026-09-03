import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const BIKE_ATTRIBUTES = ['id', 'plate', 'brand', 'model', 'cylinder', 'clientId'];
const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];
const CLIENT_INCLUDE = {
  association: 'client',
  attributes: CLIENT_ATTRIBUTES,
};

export const bikeRepository = {
  create(data, options = {}) {
    return models.Bike.create(data, {
      fields: ['plate', 'brand', 'model', 'cylinder', 'clientId'],
      transaction: options.transaction,
    });
  },

  findById(id, options = {}) {
    return models.Bike.findByPk(id, {
      attributes: BIKE_ATTRIBUTES,
      include: CLIENT_INCLUDE,
      transaction: options.transaction,
    });
  },

  existsById(id, transaction) {
    return models.Bike.findByPk(id, { attributes: ['id'], transaction });
  },

  findByPlate(plate, options = {}) {
    return models.Bike.findOne({
      attributes: ['id'],
      where: { plate },
      transaction: options.transaction,
    });
  },

  searchByPlate(plate) {
    return models.Bike.findAll({
      attributes: BIKE_ATTRIBUTES,
      include: CLIENT_INCLUDE,
      where: plate ? { plate: { [Op.like]: `%${plate}%` } } : undefined,
      order: [
        ['plate', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  },
};
