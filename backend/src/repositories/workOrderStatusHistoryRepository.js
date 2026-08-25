import { models } from '../config/databaseContext.js';

const HISTORY_ATTRIBUTES = [
  'id',
  'workOrderId',
  'fromStatus',
  'toStatus',
  'note',
  'createdAt',
];

export const workOrderStatusHistoryRepository = {
  create(data, transaction) {
    return models.WorkOrderStatusHistory.create(data, {
      fields: [
        'workOrderId',
        'fromStatus',
        'toStatus',
        'note',
        'changedByUserId',
      ],
      transaction,
    });
  },

  findPaginatedByWorkOrder(workOrderId, { page, pageSize }) {
    return models.WorkOrderStatusHistory.findAndCountAll({
      attributes: HISTORY_ATTRIBUTES,
      where: { workOrderId },
      include: {
        association: 'changedBy',
        attributes: ['id', 'name'],
        required: true,
      },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },
};
