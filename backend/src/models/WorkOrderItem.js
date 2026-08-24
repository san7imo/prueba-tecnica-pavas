import { DataTypes, Model } from 'sequelize';

import { WORK_ORDER_ITEM_TYPES } from '../constants/workOrder.js';

const greaterThanZero = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error('count must be greater than zero.');
  }
};

const nonNegative = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error('unitValue must be greater than or equal to zero.');
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
    },
    {
      sequelize,
      modelName: 'WorkOrderItem',
      tableName: 'work_order_items',
      timestamps: true,
      underscored: true,
    },
  );
