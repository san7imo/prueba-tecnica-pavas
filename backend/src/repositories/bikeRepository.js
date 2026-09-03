import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';
import { BIKE_LIFECYCLE } from '../constants/bike.js';

export const BIKE_ATTRIBUTES = [
  'id',
  'plate',
  'brand',
  'model',
  'cylinder',
  'clientId',
  'deletedAt',
  'deletedByUserId',
  'deleteReason',
];
const CLIENT_ATTRIBUTES = [
  'id',
  'name',
  'phone',
  'email',
  'deletedAt',
  'deletedByUserId',
  'deleteReason',
];
const CLIENT_INCLUDE = {
  association: 'client',
  attributes: CLIENT_ATTRIBUTES,
};
const MUTABLE_FIELDS = ['plate', 'brand', 'model', 'cylinder'];
const LIFECYCLE_FIELDS = ['deletedAt', 'deletedByUserId', 'deleteReason'];

const escapeLikePattern = (value) => value.replace(/[\\%_]/g, '\\$&');

const lifecycleWhere = (lifecycle) => {
  if (lifecycle === BIKE_LIFECYCLE.DELETED) {
    return { deletedAt: { [Op.not]: null } };
  }
  if (lifecycle === BIKE_LIFECYCLE.ALL) return {};
  return { deletedAt: null };
};

export const bikeRepository = {
  create(data, options = {}) {
    return models.Bike.create(data, {
      fields: ['plate', 'brand', 'model', 'cylinder', 'clientId'],
      transaction: options.transaction,
    });
  },

  findIdentityById(id, transaction) {
    return models.Bike.findByPk(id, {
      attributes: ['id', 'clientId'],
      transaction,
    });
  },

  findById(id, options = {}) {
    return models.Bike.findByPk(id, {
      attributes: BIKE_ATTRIBUTES,
      include: CLIENT_INCLUDE,
      transaction: options.transaction,
    });
  },

  findByIdForUpdate(id, transaction) {
    return models.Bike.findByPk(id, {
      attributes: BIKE_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  findByPlate(plate, options = {}) {
    return models.Bike.findOne({
      attributes: ['id', 'deletedAt'],
      where: { plate },
      transaction: options.transaction,
    });
  },

  findPaginated({ plate, platePrefix, clientId, lifecycle, page, pageSize }) {
    const filters = lifecycleWhere(lifecycle);
    if (plate) filters.plate = plate;
    if (platePrefix) {
      filters.plate = { [Op.like]: `${escapeLikePattern(platePrefix)}%` };
    }
    if (clientId) filters.clientId = clientId;

    return models.Bike.findAndCountAll({
      attributes: BIKE_ATTRIBUTES,
      include: CLIENT_INCLUDE,
      where: filters,
      distinct: true,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['plate', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  },

  findActiveByClientForUpdate(clientId, transaction) {
    return models.Bike.findAll({
      attributes: ['id'],
      where: { clientId, deletedAt: null },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  update(bike, data, transaction) {
    const fields = MUTABLE_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(data, field));
    return bike.update(data, { fields, transaction });
  },

  updateOwner(bike, clientId, transaction) {
    return bike.update({ clientId }, { fields: ['clientId'], transaction });
  },

  updateLifecycle(bike, data, transaction) {
    return bike.update(data, { fields: LIFECYCLE_FIELDS, transaction });
  },
};
