import {
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { initializeModels } from '../src/models/index.js';

const DOMAIN_TABLES = [
  'clients',
  'bikes',
  'work_orders',
  'work_order_items',
  'work_order_status_history',
  'users',
  'refresh_tokens',
  'audit_events',
];

let sequelize;
let migrator;
let models;

const domainTablesPresent = async () => {
  const tables = await sequelize.getQueryInterface().showAllTables();
  return tables.filter((table) => DOMAIN_TABLES.includes(table));
};

const cleanDomainData = async () => {
  if (!models) {
    return;
  }

  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
  await models.RefreshToken.destroy({ where: {}, force: true });
  await models.User.destroy({ where: {}, force: true });
};

const createClient = () =>
  models.Client.create({
    name: 'Ana Torres',
    phone: '3001234567',
    email: 'ana@example.com',
  });

const createBike = async () => {
  const client = await createClient();
  const bike = await models.Bike.create({
    plate: 'abc 12d',
    brand: 'Yamaha',
    model: 'FZ',
    cylinder: '150',
    clientId: client.id,
  });
  return { client, bike };
};

const createWorkOrder = async () => {
  const { client, bike } = await createBike();
  const workOrder = await models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-08-24T15:00:00.000Z'),
    faultDescription: 'Engine loses power under load.',
  });
  return { client, bike, workOrder };
};

describe.sequential('Persistence schema', () => {
  beforeAll(async () => {
    assertSafeTestDatabase({
      nodeEnv: env.nodeEnv,
      databaseName: env.database.name,
      developmentDatabaseName: process.env.DB_NAME,
    });

    expect(env.nodeEnv).toBe('test');
    expect(env.database.name).toBe(process.env.DB_NAME_TEST);
    expect(env.database.name).not.toBe(process.env.DB_NAME);

    sequelize = createSequelize();
    await sequelize.authenticate();
    migrator = createMigrator(sequelize);
    await migrator.down({ to: 0 });

    if ((await domainTablesPresent()).length > 0) {
      throw new Error('The integration schema was not clean before migrations.');
    }

    const applied = await migrator.up();
    expect(applied).toHaveLength(12);
    models = initializeModels(sequelize);
  });

  beforeEach(async () => {
    await cleanDomainData();
  });

  afterAll(async () => {
    if (migrator) {
      await migrator.down({ to: 0 });
    }
    if (sequelize) {
      await sequelize.close();
    }
  });

  it('applies all tables from a clean database', async () => {
    expect((await domainTablesPresent()).sort()).toEqual([...DOMAIN_TABLES].sort());
    expect(await migrator.executed()).toHaveLength(12);
  });

  it('defines and traverses the principal associations', async () => {
    expect(models.Client.associations.bikes.target).toBe(models.Bike);
    expect(models.Bike.associations.client.target).toBe(models.Client);
    expect(models.Bike.associations.workOrders.target).toBe(models.WorkOrder);
    expect(models.WorkOrder.associations.bike.target).toBe(models.Bike);
    expect(models.WorkOrder.associations.items.target).toBe(models.WorkOrderItem);
    expect(models.WorkOrderItem.associations.workOrder.target).toBe(models.WorkOrder);
    expect(models.WorkOrder.associations.statusHistory.target).toBe(
      models.WorkOrderStatusHistory,
    );
    expect(models.WorkOrderStatusHistory.associations.workOrder.target).toBe(
      models.WorkOrder,
    );
    expect(models.User.associations.statusChanges.target).toBe(
      models.WorkOrderStatusHistory,
    );
    expect(models.WorkOrderStatusHistory.associations.changedBy.target).toBe(
      models.User,
    );
    expect(models.User.associations.refreshTokens.target).toBe(models.RefreshToken);
    expect(models.RefreshToken.associations.user.target).toBe(models.User);
    expect(models.RefreshToken.associations.replacement.target).toBe(models.RefreshToken);
    expect(models.Client.associations.deletedBy.target).toBe(models.User);
    expect(models.Bike.associations.deletedBy.target).toBe(models.User);
    expect(models.WorkOrder.associations.assignedMechanic.target).toBe(models.User);
    expect(models.WorkOrderItem.associations.createdBy.target).toBe(models.User);
    expect(models.AuditEvent.associations.actor.target).toBe(models.User);
    expect(models.User.associations.deletedClients.target).toBe(models.Client);
    expect(models.User.associations.deletedBikes.target).toBe(models.Bike);
    expect(models.User.associations.assignedWorkOrders.target).toBe(models.WorkOrder);
    expect(models.User.associations.createdWorkOrderItems.target).toBe(
      models.WorkOrderItem,
    );
    expect(models.User.associations.auditEvents.target).toBe(models.AuditEvent);

    const { client, workOrder } = await createWorkOrder();
    await models.WorkOrderItem.create({
      workOrderId: workOrder.id,
      type: WORK_ORDER_ITEM_TYPE.LABOR,
      description: 'Diagnosis',
      count: '1.00',
      unitValue: '50000.00',
    });

    const loadedClient = await models.Client.findByPk(client.id, {
      include: {
        association: 'bikes',
        include: {
          association: 'workOrders',
          include: { association: 'items' },
        },
      },
    });

    expect(loadedClient.bikes).toHaveLength(1);
    expect(loadedClient.bikes[0].workOrders).toHaveLength(1);
    expect(loadedClient.bikes[0].workOrders[0].items).toHaveLength(1);
  });

  it('enforces User and RefreshToken identity constraints', async () => {
    const user = await models.User.create({
      name: 'Identity Test',
      email: '  IDENTITY@EXAMPLE.TEST ',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: 'ADMIN',
    });
    expect(user.email).toBe('identity@example.test');

    await expect(
      models.User.create({
        name: 'Duplicate',
        email: 'identity@example.test',
        passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-987654321',
        role: 'MECANICO',
      }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);

    const token = await models.RefreshToken.create({
      userId: user.id,
      familyId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60000),
    });
    const replacement = await models.RefreshToken.create({
      userId: user.id,
      familyId: token.familyId,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 60000),
    });
    token.replacedByTokenId = replacement.id;
    await token.save();

    expect(token.toJSON()).not.toHaveProperty('tokenHash');
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
  });

  it('normalizes plates and enforces their database uniqueness', async () => {
    const client = await createClient();
    const firstBike = await models.Bike.create({
      plate: '  abc 12d  ',
      brand: 'Yamaha',
      model: 'FZ',
      clientId: client.id,
    });

    expect(firstBike.plate).toBe('ABC12D');

    await expect(
      models.Bike.create({
        plate: 'abc12d',
        brand: 'Honda',
        model: 'CB',
        clientId: client.id,
      }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
  });

  it('enforces Bike -> Client at database level', async () => {
    await expect(
      models.Bike.create({
        plate: 'FK001',
        brand: 'Honda',
        model: 'CB',
        clientId: 999999,
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });

  it('enforces WorkOrder -> Bike at database level', async () => {
    await expect(
      models.WorkOrder.create({
        bikeId: 999999,
        entryDate: new Date('2026-08-24T15:00:00.000Z'),
        faultDescription: 'Invalid relation test.',
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });

  it('enforces WorkOrderItem -> WorkOrder at database level', async () => {
    await expect(
      models.WorkOrderItem.create({
        workOrderId: 999999,
        type: WORK_ORDER_ITEM_TYPE.PART,
        description: 'Invalid relation test',
        count: '1.00',
        unitValue: '1000.00',
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });

  it('uses RESTRICT deletes and CASCADE key updates on domain and audit FKs', async () => {
    const expectedConstraints = [
      'fk_audit_events_actor',
      'fk_bikes_client',
      'fk_bikes_deleted_by_user',
      'fk_clients_deleted_by_user',
      'fk_work_order_items_created_by_user',
      'fk_work_order_items_order',
      'fk_work_order_status_history_order',
      'fk_work_order_status_history_user',
      'fk_work_orders_assigned_mechanic',
      'fk_work_orders_bike',
    ];
    const [rules] = await sequelize.query(
      `SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = :schema
         AND CONSTRAINT_NAME IN (
           'fk_audit_events_actor',
           'fk_bikes_client',
           'fk_bikes_deleted_by_user',
           'fk_clients_deleted_by_user',
           'fk_work_order_items_created_by_user',
           'fk_work_orders_bike',
           'fk_work_order_items_order',
           'fk_work_order_status_history_order',
           'fk_work_order_status_history_user',
           'fk_work_orders_assigned_mechanic'
         )
       ORDER BY CONSTRAINT_NAME`,
      { replacements: { schema: env.database.name } },
    );

    expect(rules.map(({ CONSTRAINT_NAME }) => CONSTRAINT_NAME)).toEqual(
      expectedConstraints,
    );
    const lifecycleActorConstraints = new Set([
      'fk_bikes_deleted_by_user',
      'fk_clients_deleted_by_user',
    ]);
    for (const rule of rules) {
      expect(rule.DELETE_RULE).toBe('RESTRICT');
      expect(rule.UPDATE_RULE).toBe(
        lifecycleActorConstraints.has(rule.CONSTRAINT_NAME)
          ? 'RESTRICT'
          : 'CASCADE',
      );
    }
  });

  it('defines nullable productization columns and their operational indexes', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const [clientColumns, bikeColumns, orderColumns, itemColumns] =
      await Promise.all([
        queryInterface.describeTable('clients'),
        queryInterface.describeTable('bikes'),
        queryInterface.describeTable('work_orders'),
        queryInterface.describeTable('work_order_items'),
      ]);

    for (const columns of [clientColumns, bikeColumns]) {
      expect(columns.deleted_at.allowNull).toBe(true);
      expect(columns.deleted_by_user_id.allowNull).toBe(true);
      expect(columns.delete_reason.allowNull).toBe(true);
    }
    expect(orderColumns.assigned_mechanic_id.allowNull).toBe(true);
    expect(itemColumns.created_by_user_id.allowNull).toBe(true);

    const indexGroups = await Promise.all(
      ['clients', 'bikes', 'work_orders', 'work_order_items'].map((table) =>
        queryInterface.showIndex(table),
      ),
    );
    const indexNames = indexGroups.flat().map(({ name }) => name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        'ix_clients_lifecycle_name_id',
        'ix_clients_deleted_by_user',
        'ix_bikes_lifecycle_plate_id',
        'ix_bikes_client_lifecycle_plate_id',
        'ix_bikes_deleted_by_user',
        'ix_work_orders_assignee_status_entry_id',
        'ix_work_order_items_created_by_user',
      ]),
    );
  });

  it('enforces complete lifecycle metadata through MySQL CHECK constraints', async () => {
    const actor = await models.User.create({
      name: 'Lifecycle actor',
      email: 'lifecycle.actor@example.test',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: 'ADMIN',
    });
    const client = await createClient();

    client.deletedAt = new Date('2026-09-03T12:00:00.000Z');
    await expect(client.save({ validate: false })).rejects.toBeInstanceOf(
      DatabaseError,
    );

    await client.reload();
    client.set({
      deletedAt: new Date('2026-09-03T12:00:00.000Z'),
      deletedByUserId: actor.id,
      deleteReason: 'Registro duplicado de demostración',
    });
    await expect(client.save({ validate: false })).resolves.toMatchObject({
      deletedByUserId: actor.id,
      deleteReason: 'Registro duplicado de demostración',
    });

    const [checks] = await sequelize.query(
      `SELECT CONSTRAINT_NAME
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = :schema
         AND CONSTRAINT_TYPE = 'CHECK'
         AND CONSTRAINT_NAME IN (
           'chk_clients_delete_state',
           'chk_bikes_delete_state'
         )
       ORDER BY CONSTRAINT_NAME`,
      { replacements: { schema: env.database.name } },
    );
    expect(checks.map(({ CONSTRAINT_NAME }) => CONSTRAINT_NAME)).toEqual([
      'chk_bikes_delete_state',
      'chk_clients_delete_state',
    ]);
  });

  it('defines audit_events as created-at-only JSON persistence with deterministic indexes', async () => {
    const columns = await sequelize.getQueryInterface().describeTable('audit_events');
    expect(Object.keys(columns).sort()).toEqual([
      'action',
      'actor_user_id',
      'after_data',
      'before_data',
      'created_at',
      'entity_id',
      'entity_type',
      'id',
      'metadata',
      'reason',
    ]);
    expect(columns.actor_user_id.allowNull).toBe(false);
    expect(columns).not.toHaveProperty('updated_at');

    const actor = await models.User.create({
      name: 'Business audit actor',
      email: 'business.audit.actor@example.test',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: 'ADMIN',
    });
    const event = await models.AuditEvent.create({
      entityType: 'CLIENT',
      entityId: '42',
      action: 'CREATED',
      actorUserId: actor.id,
      beforeData: null,
      afterData: { id: '42', name: 'Cliente auditado' },
      metadata: { source: 'schema-test' },
      reason: null,
    });
    const loaded = await models.AuditEvent.findByPk(event.id, {
      include: { association: 'actor' },
    });
    expect(loaded.afterData).toEqual({ id: '42', name: 'Cliente auditado' });
    expect(loaded.actor.id).toBe(actor.id);

    const indexes = await sequelize.getQueryInterface().showIndex('audit_events');
    expect(indexes.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'ix_audit_events_created_id',
        'ix_audit_events_entity_created_id',
        'ix_audit_events_actor_created_id',
        'ix_audit_events_action_created_id',
      ]),
    );
    await expect(models.User.destroy({ where: { id: actor.id } }))
      .rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });

  it('defines the immutable audit columns and deterministic composite index physically', async () => {
    const columns = await sequelize.getQueryInterface().describeTable(
      'work_order_status_history',
    );
    expect(Object.keys(columns).sort()).toEqual([
      'changed_by_user_id',
      'created_at',
      'from_status',
      'id',
      'note',
      'to_status',
      'work_order_id',
    ]);
    expect(columns.from_status.allowNull).toBe(true);
    expect(columns.to_status.allowNull).toBe(false);
    expect(columns.changed_by_user_id.allowNull).toBe(false);
    expect(columns).not.toHaveProperty('updated_at');

    const [indexRows] = await sequelize.query(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, COLLATION
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = :schema
         AND TABLE_NAME = 'work_order_status_history'
         AND INDEX_NAME = 'ix_work_order_status_history_order_created_id'
       ORDER BY SEQ_IN_INDEX`,
      { replacements: { schema: env.database.name } },
    );
    expect(indexRows).toEqual([
      expect.objectContaining({ COLUMN_NAME: 'work_order_id', COLLATION: 'A' }),
      expect.objectContaining({ COLUMN_NAME: 'created_at', COLLATION: 'D' }),
      expect.objectContaining({ COLUMN_NAME: 'id', COLLATION: 'D' }),
    ]);
  });

  it('enforces both audit foreign keys and RESTRICT deletion physically', async () => {
    const actor = await models.User.create({
      name: 'Audit FK actor',
      email: 'audit.fk@example.test',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: 'ADMIN',
    });
    const { workOrder } = await createWorkOrder();
    const history = await models.WorkOrderStatusHistory.create({
      workOrderId: workOrder.id,
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      changedByUserId: actor.id,
    });

    await expect(models.WorkOrder.destroy({ where: { id: workOrder.id } }))
      .rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(models.User.destroy({ where: { id: actor.id } }))
      .rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(models.WorkOrderStatusHistory.create({
      workOrderId: 999999,
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      changedByUserId: actor.id,
    })).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(models.WorkOrderStatusHistory.create({
      workOrderId: workOrder.id,
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      changedByUserId: 999999,
    })).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    expect(history.id).toEqual(expect.any(Number));
  });

  it.each(['0.00', '-1.00'])('rejects count %s through the MySQL CHECK', async (count) => {
    const { workOrder } = await createWorkOrder();

    await expect(
      models.WorkOrderItem.create(
        {
          workOrderId: workOrder.id,
          type: WORK_ORDER_ITEM_TYPE.PART,
          description: 'Invalid quantity',
          count,
          unitValue: '1000.00',
        },
        { validate: false },
      ),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('rejects a negative unit value through the MySQL CHECK', async () => {
    const { workOrder } = await createWorkOrder();

    await expect(
      models.WorkOrderItem.create(
        {
          workOrderId: workOrder.id,
          type: WORK_ORDER_ITEM_TYPE.PART,
          description: 'Invalid value',
          count: '1.00',
          unitValue: '-0.01',
        },
        { validate: false },
      ),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('persists DECIMAL values without JavaScript floating-point conversion', async () => {
    const { workOrder } = await createWorkOrder();
    workOrder.total = '9999999999999.99';
    await workOrder.save();

    const item = await models.WorkOrderItem.create({
      workOrderId: workOrder.id,
      type: WORK_ORDER_ITEM_TYPE.LABOR,
      description: 'Fractional labor',
      count: '2.50',
      unitValue: '50000.25',
    });

    await Promise.all([workOrder.reload(), item.reload()]);

    expect(workOrder.total).toBe('9999999999999.99');
    expect(item.count).toBe('2.50');
    expect(item.unitValue).toBe('50000.25');
  });

  it('limits status and item type to the contractual enums', async () => {
    const { workOrder } = await createWorkOrder();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.RECEIVED);

    await expect(
      models.WorkOrder.create(
        {
          bikeId: workOrder.bikeId,
          entryDate: new Date('2026-08-24T15:00:00.000Z'),
          faultDescription: 'Invalid status.',
          status: 'UNKNOWN',
        },
        { validate: false },
      ),
    ).rejects.toBeInstanceOf(DatabaseError);

    await expect(
      models.WorkOrderItem.create(
        {
          workOrderId: workOrder.id,
          type: 'UNKNOWN',
          description: 'Invalid type',
          count: '1.00',
          unitValue: '0.00',
        },
        { validate: false },
      ),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('reverts every populated domain table and can reapply the full migration stack', async () => {
    const user = await models.User.create({
      name: 'Populated down test',
      email: 'populated.down@example.test',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: 'ADMIN',
    });
    await models.RefreshToken.create({
      userId: user.id,
      familyId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60000),
    });
    const { workOrder } = await createWorkOrder();
    await models.WorkOrderStatusHistory.create({
      workOrderId: workOrder.id,
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      changedByUserId: user.id,
    });

    const reverted = await migrator.down({ to: 0 });
    expect(reverted).toHaveLength(12);
    expect(await domainTablesPresent()).toEqual([]);

    const reapplied = await migrator.up();
    expect(reapplied).toHaveLength(12);
    expect((await domainTablesPresent()).sort()).toEqual([...DOMAIN_TABLES].sort());
  }, 30000);
});
