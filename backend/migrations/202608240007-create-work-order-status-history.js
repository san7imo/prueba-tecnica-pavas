import { DataTypes } from 'sequelize';

import { WORK_ORDER_STATUSES } from '../src/constants/workOrder.js';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'work_order_status_history',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      work_order_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      from_status: {
        type: DataTypes.ENUM(...WORK_ORDER_STATUSES),
        allowNull: true,
      },
      to_status: {
        type: DataTypes.ENUM(...WORK_ORDER_STATUSES),
        allowNull: false,
      },
      note: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      changed_by_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE(3),
        allowNull: false,
      },
    },
    { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  );

  try {
    await queryInterface.addConstraint('work_order_status_history', {
      fields: ['work_order_id'],
      type: 'foreign key',
      name: 'fk_work_order_status_history_order',
      references: { table: 'work_orders', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('work_order_status_history', {
      fields: ['changed_by_user_id'],
      type: 'foreign key',
      name: 'fk_work_order_status_history_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addIndex(
      'work_order_status_history',
      [
        { name: 'work_order_id', order: 'ASC' },
        { name: 'created_at', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_work_order_status_history_order_created_id' },
    );
  } catch (error) {
    await queryInterface.dropTable('work_order_status_history');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('work_order_status_history');
};
