import { DataTypes } from 'sequelize';

import {
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUSES,
} from '../src/constants/workOrder.js';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'work_orders',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      bike_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      entry_date: {
        type: DataTypes.DATE(3),
        allowNull: false,
      },
      fault_description: {
        type: DataTypes.TEXT,
        allowNull: false,
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
      created_at: {
        type: DataTypes.DATE(3),
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE(3),
        allowNull: false,
      },
    },
    {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
  );

  try {
    await queryInterface.addConstraint('work_orders', {
      fields: ['bike_id'],
      type: 'foreign key',
      name: 'fk_work_orders_bike',
      references: { table: 'bikes', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    await queryInterface.dropTable('work_orders');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('work_orders');
};

