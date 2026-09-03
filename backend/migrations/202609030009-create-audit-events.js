import { DataTypes } from 'sequelize';

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

export const up = async ({ context: queryInterface }) => {
  await queryInterface.createTable(
    'audit_events',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      entity_type: {
        type: DataTypes.ENUM(...ENTITY_TYPES),
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      action: {
        type: DataTypes.ENUM(...ACTIONS),
        allowNull: false,
      },
      actor_user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      before_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      after_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      reason: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      created_at: {
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
    await queryInterface.addIndex(
      'audit_events',
      [
        { name: 'created_at', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_audit_events_created_id' },
    );
    await queryInterface.addIndex(
      'audit_events',
      [
        { name: 'entity_type', order: 'ASC' },
        { name: 'entity_id', order: 'ASC' },
        { name: 'created_at', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_audit_events_entity_created_id' },
    );
    await queryInterface.addIndex(
      'audit_events',
      [
        { name: 'actor_user_id', order: 'ASC' },
        { name: 'created_at', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_audit_events_actor_created_id' },
    );
    await queryInterface.addIndex(
      'audit_events',
      [
        { name: 'action', order: 'ASC' },
        { name: 'created_at', order: 'DESC' },
        { name: 'id', order: 'DESC' },
      ],
      { name: 'ix_audit_events_action_created_id' },
    );
    await queryInterface.addConstraint('audit_events', {
      fields: ['actor_user_id'],
      type: 'foreign key',
      name: 'fk_audit_events_actor',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  } catch (error) {
    await queryInterface.dropTable('audit_events');
    throw error;
  }
};

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('audit_events');
};
