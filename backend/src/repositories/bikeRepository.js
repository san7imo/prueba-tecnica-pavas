import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const BIKE_ATTRIBUTES = ['id', 'plate', 'brand', 'model', 'cylinder', 'clientId'];
const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];
const CLIENT_INCLUDE = {
  association: 'client',
  attributes: CLIENT_ATTRIBUTES,
};

export const bikeRepository = {
  create(data) {
    return models.Bike.create(data, {
      fields: ['plate', 'brand', 'model', 'cylinder', 'clientId'],
    });
  },

  findById(id) {
    return models.Bike.findByPk(id, {
      attributes: BIKE_ATTRIBUTES,
      include: CLIENT_INCLUDE,
    });
  },

  existsById(id) {
    return models.Bike.findByPk(id, { attributes: ['id'] });
  },

  findByPlate(plate) {
    return models.Bike.findOne({
      attributes: ['id'],
      where: { plate },
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
