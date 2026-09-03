import { QueryTypes } from 'sequelize';

const COLUMN_NAME = 'open_bike_id';
const INDEX_NAME = 'uq_work_orders_open_bike';
const FOREIGN_KEY_NAME = 'fk_work_orders_bike';

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

const columnExists = (queryInterface) =>
  schemaObjectExists(
    queryInterface,
    'COLUMNS',
    'COLUMN_NAME',
    COLUMN_NAME,
  );

const indexExists = (queryInterface) =>
  schemaObjectExists(
    queryInterface,
    'STATISTICS',
    'INDEX_NAME',
    INDEX_NAME,
  );

const foreignKeyExists = (queryInterface) =>
  schemaObjectExists(
    queryInterface,
    'TABLE_CONSTRAINTS',
    'CONSTRAINT_NAME',
    FOREIGN_KEY_NAME,
  );

const removeBikeForeignKey = async (queryInterface) => {
  if (await foreignKeyExists(queryInterface)) {
    await queryInterface.removeConstraint('work_orders', FOREIGN_KEY_NAME);
  }
};

const addBikeForeignKey = (queryInterface, onUpdate) =>
  queryInterface.addConstraint('work_orders', {
    fields: ['bike_id'],
    type: 'foreign key',
    name: FOREIGN_KEY_NAME,
    references: { table: 'bikes', field: 'id' },
    onDelete: 'RESTRICT',
    onUpdate,
  });

const removeOpenOrderGuard = async (queryInterface) => {
  if (await indexExists(queryInterface)) {
    await queryInterface.removeIndex('work_orders', INDEX_NAME);
  }
  if (await columnExists(queryInterface)) {
    await queryInterface.removeColumn('work_orders', COLUMN_NAME);
  }
};

const duplicateOpenOrders = (queryInterface) =>
  queryInterface.sequelize.query(
    `SELECT bike_id AS bikeId, COUNT(*) AS openCount
     FROM work_orders
     WHERE status IN ('RECIBIDA', 'DIAGNOSTICO', 'EN_PROCESO', 'LISTA')
     GROUP BY bike_id
     HAVING COUNT(*) > 1
     ORDER BY bike_id ASC`,
    { type: QueryTypes.SELECT },
  );

const preflightError = (duplicates) => {
  const diagnostics = duplicates
    .map(({ bikeId, openCount }) => `bike ${bikeId} (${openCount} open orders)`)
    .join('; ');
  return new Error(
    `Single-open-order migration aborted. Resolve persisted conflicts and rerun: ${diagnostics}.`,
  );
};

export const up = async ({ context: queryInterface }) => {
  const duplicates = await duplicateOpenOrders(queryInterface);
  if (duplicates.length > 0) throw preflightError(duplicates);

  try {
    await removeBikeForeignKey(queryInterface);
    await queryInterface.sequelize.query(
      `ALTER TABLE work_orders
       ADD COLUMN open_bike_id BIGINT UNSIGNED
       GENERATED ALWAYS AS (
         CASE
           WHEN status IN ('RECIBIDA', 'DIAGNOSTICO', 'EN_PROCESO', 'LISTA')
           THEN bike_id
           ELSE NULL
         END
       ) STORED`,
    );
    await queryInterface.addIndex('work_orders', ['open_bike_id'], {
      name: INDEX_NAME,
      unique: true,
    });
    await addBikeForeignKey(queryInterface, 'RESTRICT');
  } catch (error) {
    try {
      await removeBikeForeignKey(queryInterface);
      await removeOpenOrderGuard(queryInterface);
      await addBikeForeignKey(queryInterface, 'CASCADE');
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await removeBikeForeignKey(queryInterface);
  await removeOpenOrderGuard(queryInterface);
  await addBikeForeignKey(queryInterface, 'CASCADE');
};
