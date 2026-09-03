import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const SAFE_ATTRIBUTES = ['id', 'name', 'email', 'role', 'active'];
const MANAGED_ATTRIBUTES = [...SAFE_ATTRIBUTES, 'createdAt', 'updatedAt'];

export const userRepository = {
  findForAuthentication(email, options = {}) {
    return models.User.findOne({
      where: { email },
      attributes: [...SAFE_ATTRIBUTES, 'passwordHash'],
      transaction: options.transaction,
    });
  },

  findById(id, options = {}) {
    return models.User.findByPk(id, {
      attributes: SAFE_ATTRIBUTES,
      transaction: options.transaction,
    });
  },

  findByIdsForUpdate(ids, transaction) {
    if (ids.length === 0) return [];
    return models.User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: SAFE_ATTRIBUTES,
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  findByEmail(email, options = {}) {
    return models.User.findOne({
      where: { email },
      attributes: SAFE_ATTRIBUTES,
      transaction: options.transaction,
    });
  },

  create(data, options = {}) {
    return models.User.create(data, {
      fields: ['name', 'email', 'passwordHash', 'role', 'active'],
      transaction: options.transaction,
    });
  },

  findManagedById(id, options = {}) {
    return models.User.findByPk(id, {
      attributes: MANAGED_ATTRIBUTES,
      transaction: options.transaction,
    });
  },

  listManaged() {
    return models.User.findAll({
      attributes: MANAGED_ATTRIBUTES,
      order: [
        ['name', 'ASC'],
        ['email', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  },

  updateRole(id, role) {
    return models.User.update({ role }, { where: { id }, fields: ['role'] });
  },

  updateActive(id, active) {
    return models.User.update({ active }, { where: { id }, fields: ['active'] });
  },
};
