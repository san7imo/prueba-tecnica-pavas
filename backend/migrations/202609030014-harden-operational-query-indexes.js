const INDEXES = Object.freeze([
  {
    name: 'ix_work_orders_entry_id',
    fields: [
      { name: 'entry_date', order: 'DESC' },
      { name: 'id', order: 'DESC' },
    ],
  },
  {
    name: 'ix_work_orders_status_entry_id',
    fields: [
      { name: 'status', order: 'ASC' },
      { name: 'entry_date', order: 'DESC' },
      { name: 'id', order: 'DESC' },
    ],
  },
  {
    name: 'ix_work_orders_bike_entry_id',
    fields: [
      { name: 'bike_id', order: 'ASC' },
      { name: 'entry_date', order: 'DESC' },
      { name: 'id', order: 'DESC' },
    ],
  },
]);
const BIKE_FOREIGN_KEY_INDEX = 'fk_work_orders_bike';

const indexExists = async (queryInterface, indexName) => {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'work_orders'
       AND INDEX_NAME = :indexName
     LIMIT 1`,
    { replacements: { indexName } },
  );
  return rows.length > 0;
};

const removeIndexes = async (queryInterface) => {
  if (!(await indexExists(queryInterface, BIKE_FOREIGN_KEY_INDEX))) {
    await queryInterface.addIndex('work_orders', ['bike_id'], {
      name: BIKE_FOREIGN_KEY_INDEX,
    });
  }
  for (const { name } of [...INDEXES].reverse()) {
    if (await indexExists(queryInterface, name)) {
      await queryInterface.removeIndex('work_orders', name);
    }
  }
};

export const up = async ({ context: queryInterface }) => {
  try {
    for (const { name, fields } of INDEXES) {
      await queryInterface.addIndex('work_orders', fields, { name });
    }
  } catch (error) {
    try {
      await removeIndexes(queryInterface);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await removeIndexes(queryInterface);
};
