import { DataTypes, Model } from 'sequelize';

export class RefreshToken extends Model {
  toJSON() {
    const values = { ...this.get() };
    delete values.tokenHash;
    return values;
  }
}

export const initializeRefreshToken = (sequelize) =>
  RefreshToken.init(
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
      familyId: { type: DataTypes.UUID, allowNull: false, field: 'family_id' },
      tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: 'uq_refresh_tokens_hash', field: 'token_hash' },
      expiresAt: { type: DataTypes.DATE(3), allowNull: false, field: 'expires_at' },
      revokedAt: { type: DataTypes.DATE(3), allowNull: true, field: 'revoked_at' },
      replacedByTokenId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'replaced_by_token_id',
      },
    },
    {
      sequelize,
      modelName: 'RefreshToken',
      tableName: 'refresh_tokens',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: false,
      underscored: true,
    },
  );
