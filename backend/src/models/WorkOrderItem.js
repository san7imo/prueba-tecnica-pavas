import { DataTypes, Model } from 'sequelize';

import { WORK_ORDER_ITEM_TYPES } from '../constants/workOrder.js';
import { normalizeDecimal } from '../utils/normalizeDecimal.js';

const greaterThanZero = (value) => {
  const details = [];
  normalizeDecimal({
    value,
    field: 'count',
    label: 'Count',
    precision: 10,
    scale: 2,
    allowZero: false,
    details,
  });

  if (details.length > 0) {
    throw new Error(details[0].message);
  }
};

const nonNegative = (value) => {
  const details = [];
  normalizeDecimal({
    value,
    field: 'unitValue',
    label: 'Unit value',
    precision: 15,
    scale: 2,
    allowZero: true,
    details,
  });

  if (details.length > 0) {
    throw new Error(details[0].message);
  }
};

export class WorkOrderItem extends Model {}

export const initializeWorkOrderItem = (sequelize) =>
  WorkOrderItem.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      workOrderId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'work_order_id',
      },
      type: {
        type: DataTypes.ENUM(...WORK_ORDER_ITEM_TYPES),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true },
      },
      count: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: { greaterThanZero },
      },
      unitValue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        field: 'unit_value',
        validate: { nonNegative },
      },
      createdByUserId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'created_by_user_id',
      },
    },
    {
      sequelize,
      modelName: 'WorkOrderItem',
      tableName: 'work_order_items',
      timestamps: true,
      underscored: true,
    },
  );
