import { DataTypes, Model } from 'sequelize';

export class Client extends Model {}

export const initializeClient = (sequelize) =>
  Client.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: { notEmpty: true },
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: { notEmpty: true },
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE(3),
        allowNull: true,
        field: 'deleted_at',
      },
      deletedByUserId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'deleted_by_user_id',
      },
      deleteReason: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: 'delete_reason',
      },
    },
    {
      sequelize,
      modelName: 'Client',
      tableName: 'clients',
      timestamps: true,
      underscored: true,
    },
  );
