import { DataTypes } from 'sequelize';

const schemaObjectExists = async (
  queryInterface,
  informationSchemaTable,
  objectColumn,
  objectName,
) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
     FROM information_schema.${informationSchemaTable}
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'work_order_items'
       AND ${objectColumn} = :objectName
     LIMIT 1`,
    { replacements: { objectName } },
  );
  return rows.length > 0;
};

const removeCreator = async (queryInterface) => {
  if (
    await schemaObjectExists(
      queryInterface,
      'TABLE_CONSTRAINTS',
      'CONSTRAINT_NAME',
      'fk_work_order_items_created_by_user',
    )
  ) {
    await queryInterface.removeConstraint(
      'work_order_items',
      'fk_work_order_items_created_by_user',
    );
  }
  if (
    await schemaObjectExists(
      queryInterface,
      'STATISTICS',
      'INDEX_NAME',
      'ix_work_order_items_created_by_user',
    )
  ) {
    await queryInterface.removeIndex(
      'work_order_items',
      'ix_work_order_items_created_by_user',
    );
  }
  if (
    await schemaObjectExists(
      queryInterface,
      'COLUMNS',
      'COLUMN_NAME',
      'created_by_user_id',
    )
  ) {
    await queryInterface.removeColumn('work_order_items', 'created_by_user_id');
  }
};

export const up = async ({ context: queryInterface }) => {
  try {
    await queryInterface.addColumn('work_order_items', 'created_by_user_id', {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('work_order_items', ['created_by_user_id'], {
      name: 'ix_work_order_items_created_by_user',
    });
    await queryInterface.addConstraint('work_order_items', {
      fields: ['created_by_user_id'],
      type: 'foreign key',
      name: 'fk_work_order_items_created_by_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    try {
      await removeCreator(queryInterface);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await removeCreator(queryInterface);
};
