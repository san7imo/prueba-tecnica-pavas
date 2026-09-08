import { DataTypes } from 'sequelize';

const TABLE = 'clients';
const COLUMN = 'document_number';
const UNIQUE_INDEX = 'uq_clients_document_number';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.addColumn(TABLE, COLUMN, {
    type: DataTypes.STRING(20),
    allowNull: true,
  });

  try {
    await queryInterface.addIndex(TABLE, [COLUMN], {
      name: UNIQUE_INDEX,
      unique: true,
    });
  } catch (error) {
    await queryInterface.removeColumn(TABLE, COLUMN);
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex(TABLE, UNIQUE_INDEX);
  await queryInterface.removeColumn(TABLE, COLUMN);
};

