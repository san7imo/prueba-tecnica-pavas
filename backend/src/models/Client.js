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
    },
    {
      sequelize,
      modelName: 'Client',
      tableName: 'clients',
      timestamps: true,
      underscored: true,
    },
  );

