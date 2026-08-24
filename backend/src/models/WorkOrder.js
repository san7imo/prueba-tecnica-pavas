import { DataTypes, Model } from 'sequelize';

import {
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUSES,
} from '../constants/workOrder.js';

export class WorkOrder extends Model {}

export const initializeWorkOrder = (sequelize) =>
  WorkOrder.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      bikeId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'bike_id',
      },
      entryDate: {
        type: DataTypes.DATE(3),
        allowNull: false,
        field: 'entry_date',
      },
      faultDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'fault_description',
        validate: { notEmpty: true },
      },
      status: {
        type: DataTypes.ENUM(...WORK_ORDER_STATUSES),
        allowNull: false,
        defaultValue: WORK_ORDER_STATUS.RECEIVED,
      },
      total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: '0.00',
      },
    },
    {
      sequelize,
      modelName: 'WorkOrder',
      tableName: 'work_orders',
      timestamps: true,
      underscored: true,
    },
  );

