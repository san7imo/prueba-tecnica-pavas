import { DataTypes, Model } from 'sequelize';

import { normalizePlate } from '../utils/normalizePlate.js';

export class Bike extends Model {}

export const initializeBike = (sequelize) =>
  Bike.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      plate: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: 'uq_bikes_plate',
        set(value) {
          this.setDataValue('plate', normalizePlate(value));
        },
        validate: { notEmpty: true },
      },
      brand: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
      },
      model: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
      },
      cylinder: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      clientId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'client_id',
      },
    },
    {
      sequelize,
      modelName: 'Bike',
      tableName: 'bikes',
      timestamps: true,
      underscored: true,
    },
  );

