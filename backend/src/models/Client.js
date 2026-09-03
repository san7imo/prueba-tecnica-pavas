import { DataTypes, Model } from 'sequelize';

import {
  isValidClientEmail,
  isValidClientPhone,
  normalizeClientEmail,
  normalizeClientPhone,
} from '../utils/clientContacts.js';

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
        set(value) {
          this.setDataValue(
            'phone',
            typeof value === 'string' ? normalizeClientPhone(value) : value,
          );
        },
        validate: {
          isCanonicalPhone(value) {
            if (!isValidClientPhone(value)) {
              throw new Error('Phone must be a canonical client phone.');
            }
          },
        },
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: true,
        set(value) {
          this.setDataValue(
            'email',
            typeof value === 'string' ? normalizeClientEmail(value) : value,
          );
        },
        validate: {
          isValidOptionalEmail(value) {
            if (
              value !== null &&
              value !== undefined &&
              !isValidClientEmail(value)
            ) {
              throw new Error('Email must be valid.');
            }
          },
        },
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
