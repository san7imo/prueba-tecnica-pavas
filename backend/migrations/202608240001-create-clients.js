import { DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'clients',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: true,
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
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('clients');
};

