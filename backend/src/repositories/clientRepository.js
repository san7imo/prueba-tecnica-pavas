import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];

export const clientRepository = {
  create(data, options = {}) {
    return models.Client.create(data, {
      fields: ['name', 'phone', 'email'],
      transaction: options.transaction,
    });
  },

  findById(id, options = {}) {
    return models.Client.findByPk(id, {
      attributes: CLIENT_ATTRIBUTES,
      transaction: options.transaction,
    });
  },

  search(search) {
    const where = search
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return models.Client.findAll({
      attributes: CLIENT_ATTRIBUTES,
      where,
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  },
};
