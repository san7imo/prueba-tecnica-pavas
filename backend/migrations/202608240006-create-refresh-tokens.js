import { DataTypes } from 'sequelize';

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'refresh_tokens',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      family_id: { type: DataTypes.UUID, allowNull: false },
      token_hash: { type: DataTypes.CHAR(64), allowNull: false },
      expires_at: { type: DataTypes.DATE(3), allowNull: false },
      revoked_at: { type: DataTypes.DATE(3), allowNull: true },
      replaced_by_token_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
    },
    { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  );

  try {
    await queryInterface.addIndex('refresh_tokens', ['token_hash'], {
      name: 'uq_refresh_tokens_hash',
      unique: true,
    });
    await queryInterface.addIndex('refresh_tokens', ['family_id', 'revoked_at'], {
      name: 'ix_refresh_tokens_family_active',
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id', 'family_id'], {
      name: 'ix_refresh_tokens_user_family',
    });
    await queryInterface.addIndex('refresh_tokens', ['expires_at'], {
      name: 'ix_refresh_tokens_expires_at',
    });
    await queryInterface.addConstraint('refresh_tokens', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_refresh_tokens_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('refresh_tokens', {
      fields: ['replaced_by_token_id'],
      type: 'foreign key',
      name: 'fk_refresh_tokens_replacement',
      references: { table: 'refresh_tokens', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    await queryInterface.dropTable('refresh_tokens');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.removeConstraint(
    'refresh_tokens',
    'fk_refresh_tokens_replacement',
  );
  await queryInterface.removeConstraint('refresh_tokens', 'fk_refresh_tokens_user');
  await queryInterface.dropTable('refresh_tokens');
};
