import { models } from '../config/databaseContext.js';

const SAFE_ATTRIBUTES = ['id', 'name', 'email', 'role', 'active'];

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

  findByEmail(email, options = {}) {
    return models.User.findOne({
      where: { email },
      attributes: [...SAFE_ATTRIBUTES, 'passwordHash'],
      transaction: options.transaction,
    });
  },

  create(data, options = {}) {
    return models.User.create(data, {
      fields: ['name', 'email', 'passwordHash', 'role', 'active'],
      transaction: options.transaction,
    });
  },
};
