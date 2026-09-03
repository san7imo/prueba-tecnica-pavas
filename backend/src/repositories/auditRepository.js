import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const AUDIT_ATTRIBUTES = [
  'id',
  'entityType',
  'entityId',
  'action',
  'actorUserId',
  'beforeData',
  'afterData',
  'metadata',
  'reason',
  'createdAt',
];

const ACTOR_INCLUDE = {
  association: 'actor',
  attributes: ['id', 'name'],
  required: true,
};

export const auditRepository = {
  create(data, transaction) {
    return models.AuditEvent.create(data, {
      fields: [
        'entityType',
        'entityId',
        'action',
        'actorUserId',
        'beforeData',
        'afterData',
        'metadata',
        'reason',
      ],
      transaction,
    });
  },

  findById(id) {
    return models.AuditEvent.findByPk(id, {
      attributes: AUDIT_ATTRIBUTES,
      include: ACTOR_INCLUDE,
    });
  },

  findPaginated({
    entityType,
    entityId,
    action,
    actorUserId,
    dateFrom,
    dateTo,
    page,
    pageSize,
  }) {
    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = dateFrom;
      if (dateTo) where.createdAt[Op.lte] = dateTo;
    }

    return models.AuditEvent.findAndCountAll({
      attributes: AUDIT_ATTRIBUTES,
      include: ACTOR_INCLUDE,
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },
};
