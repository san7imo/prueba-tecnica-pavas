import { literal } from 'sequelize';

import { models } from '../config/databaseContext.js';

const EXACT_TOTAL_EXPRESSION = literal(
  'CAST(COALESCE(SUM(`count` * `unit_value`), 0) AS DECIMAL(15,2))',
);

export const workOrderItemRepository = {
  create(data, transaction) {
    return models.WorkOrderItem.create(data, {
      fields: ['workOrderId', 'type', 'description', 'count', 'unitValue'],
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
      attributes: ['id', 'workOrderId'],
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
