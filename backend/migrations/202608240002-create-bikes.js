import { DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'bikes',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      plate: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      brand: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      model: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      cylinder: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      client_id: {
        type: DataTypes.BIGINT.UNSIGNED,
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
    await queryInterface.addIndex('bikes', ['plate'], {
      name: 'uq_bikes_plate',
      unique: true,
    });
    await queryInterface.addConstraint('bikes', {
      fields: ['client_id'],
      type: 'foreign key',
      name: 'fk_bikes_client',
      references: { table: 'clients', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    await queryInterface.dropTable('bikes');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('bikes');
};

