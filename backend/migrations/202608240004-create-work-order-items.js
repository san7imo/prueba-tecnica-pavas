import { DataTypes, Op } from 'sequelize';

import { WORK_ORDER_ITEM_TYPES } from '../src/constants/workOrder.js';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'work_order_items',
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
      type: {
        type: DataTypes.ENUM(...WORK_ORDER_ITEM_TYPES),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      count: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit_value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
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
    await queryInterface.addConstraint('work_order_items', {
      fields: ['work_order_id'],
      type: 'foreign key',
      name: 'fk_work_order_items_order',
      references: { table: 'work_orders', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('work_order_items', {
      fields: ['count'],
      type: 'check',
      name: 'chk_work_order_items_count_positive',
      where: { count: { [Op.gt]: 0 } },
    });
    await queryInterface.addConstraint('work_order_items', {
      fields: ['unit_value'],
      type: 'check',
      name: 'chk_work_order_items_unit_value_nonnegative',
      where: { unit_value: { [Op.gte]: 0 } },
    });
  } catch (error) {
    await queryInterface.dropTable('work_order_items');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('work_order_items');
};

