import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';
import { USER_ROLE } from '../constants/auth.js';

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

  findLifecycleLockSet(id, includeActiveAdmins, transaction) {
    const where = includeActiveAdmins
      ? {
          [Op.or]: [
            { id },
            { role: USER_ROLE.ADMIN, active: true },
          ],
        }
      : { id };
    return models.User.findAll({
      where,
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

  updateRole(user, role, transaction) {
    return user.update({ role }, { fields: ['role'], transaction });
  },

  updateActive(user, active, transaction) {
    return user.update({ active }, { fields: ['active'], transaction });
  },
};
