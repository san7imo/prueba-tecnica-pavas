import { literal } from 'sequelize';

import { models } from '../config/databaseContext.js';

const EXACT_TOTAL_EXPRESSION = literal(
  'CAST(COALESCE(SUM(`count` * `unit_value`), 0) AS DECIMAL(15,2))',
);
const ITEM_ATTRIBUTES = [
  'id',
  'workOrderId',
  'type',
  'description',
  'count',
  'unitValue',
  'createdByUserId',
];
const CREATED_BY_INCLUDE = {
  association: 'createdBy',
  attributes: ['id', 'name'],
  required: false,
};

export const workOrderItemRepository = {
  create(data, transaction) {
    return models.WorkOrderItem.create(data, {
      fields: [
        'workOrderId',
        'type',
        'description',
        'count',
        'unitValue',
        'createdByUserId',
      ],
      transaction,
    });
  },

  findByIdWithCreator(id, transaction) {
    return models.WorkOrderItem.findByPk(id, {
      attributes: ITEM_ATTRIBUTES,
      include: CREATED_BY_INCLUDE,
      transaction,
    });
  },

  findById(id, transaction) {
    return models.WorkOrderItem.findByPk(id, {
      attributes: ['id', 'workOrderId'],
      transaction,
    });
  },

  findByIdForWorkOrderForUpdate(id, workOrderId, transaction) {
    return models.WorkOrderItem.findOne({
      attributes: ITEM_ATTRIBUTES,
      where: { id, workOrderId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  deleteById(id, transaction) {
    return models.WorkOrderItem.destroy({ where: { id }, transaction });
  },

  async calculateTotal(workOrderId, transaction) {
    const result = await models.WorkOrderItem.findOne({
      attributes: [[EXACT_TOTAL_EXPRESSION, 'total']],
      where: { workOrderId },
      raw: true,
      transaction,
    });

    return result.total;
  },
};
