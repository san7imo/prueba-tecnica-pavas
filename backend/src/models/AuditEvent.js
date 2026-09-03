import { DataTypes, Model } from 'sequelize';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../constants/audit.js';

export class AuditEvent extends Model {}

export const initializeAuditEvent = (sequelize) =>
  AuditEvent.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      entityType: {
        type: DataTypes.ENUM(...AUDIT_ENTITY_TYPES),
        allowNull: false,
        field: 'entity_type',
      },
      entityId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'entity_id',
      },
      action: {
        type: DataTypes.ENUM(...AUDIT_ACTIONS),
        allowNull: false,
      },
      actorUserId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'actor_user_id',
      },
      beforeData: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'before_data',
      },
      afterData: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'after_data',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      reason: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AuditEvent',
      tableName: 'audit_events',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: false,
      underscored: true,
    },
  );
