import { DataTypes } from 'sequelize';

const schemaObjectExists = async (
  queryInterface,
  informationSchemaTable,
  tableName,
  objectColumn,
  objectName,
) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
     FROM information_schema.${informationSchemaTable}
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND ${objectColumn} = :objectName
     LIMIT 1`,
    { replacements: { tableName, objectName } },
  );
  return rows.length > 0;
};

const constraintExists = (queryInterface, tableName, constraintName) =>
  schemaObjectExists(
    queryInterface,
    'TABLE_CONSTRAINTS',
    tableName,
    'CONSTRAINT_NAME',
    constraintName,
  );

const indexExists = (queryInterface, tableName, indexName) =>
  schemaObjectExists(
    queryInterface,
    'STATISTICS',
    tableName,
    'INDEX_NAME',
    indexName,
  );

const columnExists = (queryInterface, tableName, columnName) =>
  schemaObjectExists(
    queryInterface,
    'COLUMNS',
    tableName,
    'COLUMN_NAME',
    columnName,
  );

const removeLifecycle = async (queryInterface, tableName, names) => {
  if (await constraintExists(queryInterface, tableName, names.deletedByForeignKey)) {
    await queryInterface.removeConstraint(tableName, names.deletedByForeignKey);
  }
  if (await constraintExists(queryInterface, tableName, names.deleteStateCheck)) {
    await queryInterface.sequelize.query(
      `ALTER TABLE \`${tableName}\` DROP CHECK \`${names.deleteStateCheck}\``,
    );
  }
  if (await indexExists(queryInterface, tableName, names.deletedByIndex)) {
    await queryInterface.removeIndex(tableName, names.deletedByIndex);
  }
  if (await indexExists(queryInterface, tableName, names.lifecycleIndex)) {
    await queryInterface.removeIndex(tableName, names.lifecycleIndex);
  }
  if (
    names.ownerLifecycleIndex &&
    (await indexExists(queryInterface, tableName, names.ownerLifecycleIndex))
  ) {
    if (!(await indexExists(queryInterface, tableName, 'fk_bikes_client'))) {
      await queryInterface.addIndex('bikes', ['client_id'], {
        name: 'fk_bikes_client',
      });
    }
    await queryInterface.removeIndex(tableName, names.ownerLifecycleIndex);
  }
  for (const columnName of [
    'delete_reason',
    'deleted_by_user_id',
    'deleted_at',
  ]) {
    if (await columnExists(queryInterface, tableName, columnName)) {
      await queryInterface.removeColumn(tableName, columnName);
    }
  }
};

const addLifecycleColumns = async (queryInterface, tableName) => {
  await queryInterface.addColumn(tableName, 'deleted_at', {
    type: DataTypes.DATE(3),
    allowNull: true,
  });
  await queryInterface.addColumn(tableName, 'deleted_by_user_id', {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  });
  await queryInterface.addColumn(tableName, 'delete_reason', {
    type: DataTypes.STRING(1000),
    allowNull: true,
  });
};

const CLIENT_NAMES = Object.freeze({
  deleteStateCheck: 'chk_clients_delete_state',
  deletedByForeignKey: 'fk_clients_deleted_by_user',
  deletedByIndex: 'ix_clients_deleted_by_user',
  lifecycleIndex: 'ix_clients_lifecycle_name_id',
});

const BIKE_NAMES = Object.freeze({
  deleteStateCheck: 'chk_bikes_delete_state',
  deletedByForeignKey: 'fk_bikes_deleted_by_user',
  deletedByIndex: 'ix_bikes_deleted_by_user',
  lifecycleIndex: 'ix_bikes_lifecycle_plate_id',
  ownerLifecycleIndex: 'ix_bikes_client_lifecycle_plate_id',
});

export const up = async ({ context: queryInterface }) => {
  try {
    await addLifecycleColumns(queryInterface, 'clients');
    await queryInterface.sequelize.query(
      `ALTER TABLE clients
       ADD CONSTRAINT chk_clients_delete_state
       CHECK (
         (deleted_at IS NULL AND deleted_by_user_id IS NULL AND delete_reason IS NULL)
         OR
         (deleted_at IS NOT NULL AND deleted_by_user_id IS NOT NULL
           AND delete_reason IS NOT NULL AND CHAR_LENGTH(TRIM(delete_reason)) > 0)
       )`,
    );
    await queryInterface.addIndex(
      'clients',
      ['deleted_at', 'name', 'id'],
      { name: CLIENT_NAMES.lifecycleIndex },
    );
    await queryInterface.addIndex('clients', ['deleted_by_user_id'], {
      name: CLIENT_NAMES.deletedByIndex,
    });
    await queryInterface.addConstraint('clients', {
      fields: ['deleted_by_user_id'],
      type: 'foreign key',
      name: CLIENT_NAMES.deletedByForeignKey,
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT',
    });

    await addLifecycleColumns(queryInterface, 'bikes');
    await queryInterface.sequelize.query(
      `ALTER TABLE bikes
       ADD CONSTRAINT chk_bikes_delete_state
       CHECK (
         (deleted_at IS NULL AND deleted_by_user_id IS NULL AND delete_reason IS NULL)
         OR
         (deleted_at IS NOT NULL AND deleted_by_user_id IS NOT NULL
           AND delete_reason IS NOT NULL AND CHAR_LENGTH(TRIM(delete_reason)) > 0)
       )`,
    );
    await queryInterface.addIndex(
      'bikes',
      ['deleted_at', 'plate', 'id'],
      { name: BIKE_NAMES.lifecycleIndex },
    );
    await queryInterface.addIndex(
      'bikes',
      ['client_id', 'deleted_at', 'plate', 'id'],
      { name: BIKE_NAMES.ownerLifecycleIndex },
    );
    await queryInterface.addIndex('bikes', ['deleted_by_user_id'], {
      name: BIKE_NAMES.deletedByIndex,
    });
    await queryInterface.addConstraint('bikes', {
      fields: ['deleted_by_user_id'],
      type: 'foreign key',
      name: BIKE_NAMES.deletedByForeignKey,
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT',
    });
  } catch (error) {
    try {
      await removeLifecycle(queryInterface, 'bikes', BIKE_NAMES);
      await removeLifecycle(queryInterface, 'clients', CLIENT_NAMES);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await removeLifecycle(queryInterface, 'bikes', BIKE_NAMES);
  await removeLifecycle(queryInterface, 'clients', CLIENT_NAMES);
};
