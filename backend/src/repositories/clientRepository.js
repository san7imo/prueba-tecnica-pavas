import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';
import {
  CLIENT_LIFECYCLE,
} from '../constants/client.js';

export const CLIENT_ATTRIBUTES = [
  'id',
  'name',
  'phone',
  'email',
  'deletedAt',
  'deletedByUserId',
  'deleteReason',
];

const DUPLICATE_ATTRIBUTES = ['id', 'phone', 'email', 'deletedAt'];
const MUTABLE_FIELDS = ['name', 'phone', 'email'];
const LIFECYCLE_FIELDS = ['deletedAt', 'deletedByUserId', 'deleteReason'];

const lifecycleWhere = (lifecycle) => {
  if (lifecycle === CLIENT_LIFECYCLE.DELETED) {
    return { deletedAt: { [Op.not]: null } };
  }
  if (lifecycle === CLIENT_LIFECYCLE.ALL) return {};
  return { deletedAt: null };
};

const searchWhere = (search, phoneSearch) => {
  if (!search) return {};
  const alternatives = [
    { name: { [Op.like]: `%${search}%` } },
    { email: { [Op.like]: `%${search}%` } },
  ];
  if (phoneSearch) alternatives.push({ phone: { [Op.like]: `%${phoneSearch}%` } });
  return { [Op.or]: alternatives };
};

export const clientRepository = {
  create(data, options = {}) {
    return models.Client.create(data, {
      fields: MUTABLE_FIELDS,
      transaction: options.transaction,
    });
  },

  findById(id, options = {}) {
    return models.Client.findByPk(id, {
      attributes: CLIENT_ATTRIBUTES,
      transaction: options.transaction,
    });
  },

  findByIdForUpdate(id, transaction) {
    return models.Client.findByPk(id, {
      attributes: CLIENT_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  findPaginated({ search, phoneSearch, lifecycle, page, pageSize }) {
    return models.Client.findAndCountAll({
      attributes: CLIENT_ATTRIBUTES,
      where: {
        [Op.and]: [
          lifecycleWhere(lifecycle),
          searchWhere(search, phoneSearch),
        ],
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['name', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  },

  findDuplicateCandidates({ phone, email, excludeId }, transaction) {
    const alternatives = [];
    if (phone) alternatives.push({ phone });
    if (email) alternatives.push({ email });
    if (alternatives.length === 0) return Promise.resolve([]);

    const conditions = [{ [Op.or]: alternatives }];
    if (excludeId) conditions.push({ id: { [Op.ne]: excludeId } });
    return models.Client.findAll({
      attributes: DUPLICATE_ATTRIBUTES,
      where: { [Op.and]: conditions },
      transaction,
      order: [['id', 'ASC']],
    });
  },

  update(client, data, transaction) {
    const fields = MUTABLE_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(data, field));
    return client.update(data, { fields, transaction });
  },

  updateLifecycle(client, data, transaction) {
    return client.update(data, { fields: LIFECYCLE_FIELDS, transaction });
  },
};
