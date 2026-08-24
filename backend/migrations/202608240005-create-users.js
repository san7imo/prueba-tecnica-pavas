import { DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'users',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM('ADMIN', 'MECANICO'), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      updated_at: { type: DataTypes.DATE(3), allowNull: false },
    },
    { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  );

  try {
    await queryInterface.addIndex('users', ['email'], {
      name: 'uq_users_email',
      unique: true,
    });
  } catch (error) {
    await queryInterface.dropTable('users');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('users');
};
