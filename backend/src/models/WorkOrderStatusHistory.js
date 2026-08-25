import { DataTypes, Model } from 'sequelize';

import { WORK_ORDER_STATUSES } from '../constants/workOrder.js';

export class WorkOrderStatusHistory extends Model {}

export const initializeWorkOrderStatusHistory = (sequelize) =>
  WorkOrderStatusHistory.init(
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
      fromStatus: {
        type: DataTypes.ENUM(...WORK_ORDER_STATUSES),
        allowNull: true,
        field: 'from_status',
      },
      toStatus: {
        type: DataTypes.ENUM(...WORK_ORDER_STATUSES),
        allowNull: false,
        field: 'to_status',
      },
      note: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      changedByUserId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'changed_by_user_id',
      },
    },
    {
      sequelize,
      modelName: 'WorkOrderStatusHistory',
      tableName: 'work_order_status_history',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: false,
      underscored: true,
    },
  );
