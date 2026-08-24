import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];

export const clientRepository = {
  create(data) {
    return models.Client.create(data, { fields: ['name', 'phone', 'email'] });
  },

  findById(id) {
    return models.Client.findByPk(id, { attributes: CLIENT_ATTRIBUTES });
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
