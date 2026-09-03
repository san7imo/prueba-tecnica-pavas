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
       AND TABLE_NAME = 'work_orders'
       AND ${objectColumn} = :objectName
     LIMIT 1`,
    { replacements: { objectName } },
  );
  return rows.length > 0;
};

const removeAssignment = async (queryInterface) => {
  if (
    await schemaObjectExists(
      queryInterface,
      'TABLE_CONSTRAINTS',
      'CONSTRAINT_NAME',
      'fk_work_orders_assigned_mechanic',
    )
  ) {
    await queryInterface.removeConstraint(
      'work_orders',
      'fk_work_orders_assigned_mechanic',
    );
  }
  if (
    await schemaObjectExists(
      queryInterface,
      'STATISTICS',
      'INDEX_NAME',
      'ix_work_orders_assignee_status_entry_id',
    )
  ) {
    await queryInterface.removeIndex(
      'work_orders',
      'ix_work_orders_assignee_status_entry_id',
    );
  }
  if (
    await schemaObjectExists(
      queryInterface,
      'COLUMNS',
      'COLUMN_NAME',
      'assigned_mechanic_id',
    )
  ) {
    await queryInterface.removeColumn('work_orders', 'assigned_mechanic_id');
  }
};

export const up = async ({ context: queryInterface }) => {
  try {
    await queryInterface.addColumn('work_orders', 'assigned_mechanic_id', {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex(
      'work_orders',
      [
        { name: 'assigned_mechanic_id', order: 'ASC' },
        { name: 'status', order: 'ASC' },
        { name: 'entry_date', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_work_orders_assignee_status_entry_id' },
    );
    await queryInterface.addConstraint('work_orders', {
      fields: ['assigned_mechanic_id'],
      type: 'foreign key',
      name: 'fk_work_orders_assigned_mechanic',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    try {
      await removeAssignment(queryInterface);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await removeAssignment(queryInterface);
};
