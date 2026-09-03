import { DataTypes, Model } from 'sequelize';

const ENTITY_TYPES = [
  'CLIENT',
  'BIKE',
  'WORK_ORDER',
  'WORK_ORDER_ITEM',
  'USER',
];

const ACTIONS = [
  'CREATED',
  'UPDATED',
  'SOFT_DELETED',
  'RESTORED',
  'OWNER_CHANGED',
  'ASSIGNED',
  'REASSIGNED',
  'UNASSIGNED',
  'STATUS_CHANGED',
  'REOPENED',
  'CANCELLED',
  'ITEM_ADDED',
  'ITEM_DELETED',
  'ROLE_CHANGED',
  'ACTIVATED',
  'DEACTIVATED',
];

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
        type: DataTypes.ENUM(...ENTITY_TYPES),
        allowNull: false,
        field: 'entity_type',
      },
      entityId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        field: 'entity_id',
      },
      action: {
        type: DataTypes.ENUM(...ACTIONS),
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
