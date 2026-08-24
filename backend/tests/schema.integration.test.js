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

const DOMAIN_TABLES = ['clients', 'bikes', 'work_orders', 'work_order_items'];

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

  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
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

describe.sequential('Phase 1 persistence schema', () => {
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
    expect(applied).toHaveLength(4);
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
    expect(await migrator.executed()).toHaveLength(4);
  });

  it('defines and traverses the principal associations', async () => {
    expect(models.Client.associations.bikes.target).toBe(models.Bike);
    expect(models.Bike.associations.client.target).toBe(models.Client);
    expect(models.Bike.associations.workOrders.target).toBe(models.WorkOrder);
    expect(models.WorkOrder.associations.bike.target).toBe(models.Bike);
    expect(models.WorkOrder.associations.items.target).toBe(models.WorkOrderItem);
    expect(models.WorkOrderItem.associations.workOrder.target).toBe(models.WorkOrder);

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

  it('uses RESTRICT deletes and CASCADE key updates on every Phase 1 FK', async () => {
    const [rules] = await sequelize.query(
      `SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = :schema
         AND CONSTRAINT_NAME IN (
           'fk_bikes_client',
           'fk_work_orders_bike',
           'fk_work_order_items_order'
         )
       ORDER BY CONSTRAINT_NAME`,
      { replacements: { schema: env.database.name } },
    );

    expect(rules).toHaveLength(3);
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'CASCADE' }),
        expect.objectContaining({ DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'CASCADE' }),
        expect.objectContaining({ DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'CASCADE' }),
      ]),
    );
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

  it('reverts every domain table and can reapply the full migration stack', async () => {
    const reverted = await migrator.down({ to: 0 });
    expect(reverted).toHaveLength(4);
    expect(await domainTablesPresent()).toEqual([]);

    const reapplied = await migrator.up();
    expect(reapplied).toHaveLength(4);
    expect((await domainTablesPresent()).sort()).toEqual([...DOMAIN_TABLES].sort());
  });
});
