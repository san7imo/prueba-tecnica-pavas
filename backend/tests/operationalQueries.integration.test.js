import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { USER_ROLE } from '../src/constants/auth.js';
import { WORK_ORDER_STATUS } from '../src/constants/workOrder.js';
import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { initializeModels } from '../src/models/index.js';

const PERFORMANCE_INDEXES = Object.freeze({
  ix_work_orders_entry_id: ['entry_date', 'id'],
  ix_work_orders_status_entry_id: ['status', 'entry_date', 'id'],
  ix_work_orders_bike_entry_id: ['bike_id', 'entry_date', 'id'],
});

describe.sequential('HITO 15 operational query hardening', () => {
  let sequelize;
  let migrator;
  let models;

  const cleanData = async () => {
    await models.AuditEvent.destroy({ where: {}, force: true });
    await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
    await models.WorkOrderItem.destroy({ where: {}, force: true });
    await models.WorkOrder.destroy({ where: {}, force: true });
    await models.Bike.destroy({ where: {}, force: true });
    await models.Client.destroy({ where: {}, force: true });
    await models.RefreshToken.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
  };

  const workOrderIndexes = async () => {
    const indexes = await sequelize.getQueryInterface().showIndex('work_orders');
    return new Map(indexes.map((index) => [
      index.name,
      index.fields.map(({ attribute }) => attribute),
    ]));
  };

  const explain = (sql, replacements = {}) =>
    sequelize.query(`EXPLAIN ${sql}`, {
      replacements,
      type: QueryTypes.SELECT,
    });

  beforeAll(async () => {
    assertSafeTestDatabase({
      nodeEnv: env.nodeEnv,
      databaseName: env.database.name,
      developmentDatabaseName: process.env.DB_NAME,
    });
    sequelize = createSequelize();
    await sequelize.authenticate();
    migrator = createMigrator(sequelize);
    await migrator.down({ to: 0 });
    await migrator.up();
    models = initializeModels(sequelize);
  });

  beforeEach(async () => {
    await cleanData();
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    if (sequelize) await sequelize.close();
  });

  it('adds only the three indexes required by the remaining operational reads', async () => {
    const indexes = await workOrderIndexes();

    for (const [name, columns] of Object.entries(PERFORMANCE_INDEXES)) {
      expect(indexes.get(name)).toEqual(columns);
    }
    expect(indexes.get('ix_work_orders_assignee_status_entry_id')).toEqual([
      'assigned_mechanic_id',
      'status',
      'entry_date',
      'id',
    ]);
    expect(indexes.get('uq_work_orders_open_bike')).toEqual(['open_bike_id']);
  });

  it('removes and reapplies the performance indexes without changing domain rows', async () => {
    const client = await models.Client.create({
      name: 'Migration Preservation Client',
      phone: '3001234567',
      email: 'migration.preservation@example.test',
    });
    const bike = await models.Bike.create({
      plate: 'MIG015',
      brand: 'Yamaha',
      model: 'FZ',
      clientId: client.id,
    });
    await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date('2026-09-03T12:00:00.000Z'),
      faultDescription: 'Migration preservation fixture.',
      status: WORK_ORDER_STATUS.DELIVERED,
    });

    const revertedDocumentMigration = await migrator.down({ step: 1 });
    const revertedIndexMigration = await migrator.down({ step: 1 });
    expect([
      ...revertedDocumentMigration,
      ...revertedIndexMigration,
    ].map(({ name }) => name)).toEqual([
      '202609050015-add-client-document-number.js',
      '202609030014-harden-operational-query-indexes.js',
    ]);
    const revertedIndexes = await workOrderIndexes();
    for (const name of Object.keys(PERFORMANCE_INDEXES)) {
      expect(revertedIndexes.has(name)).toBe(false);
    }
    expect(await models.WorkOrder.count()).toBe(1);

    const reapplied = await migrator.up();
    expect(reapplied.map(({ name }) => name)).toEqual([
      '202609030014-harden-operational-query-indexes.js',
      '202609050015-add-client-document-number.js',
    ]);
    expect(await models.WorkOrder.count()).toBe(1);
  });

  it('uses the intended indexes for exact plate and representative order queues', async () => {
    const mechanic = await models.User.create({
      name: 'Performance Mechanic',
      email: 'performance.mechanic@example.test',
      passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
      role: USER_ROLE.MECHANIC,
    });
    const client = await models.Client.create({
      name: 'Performance Client',
      phone: '3007654321',
      email: 'performance.client@example.test',
    });
    const bikes = await models.Bike.bulkCreate(
      Array.from({ length: 40 }, (_, index) => ({
        plate: `PERF${String(index).padStart(3, '0')}`,
        brand: 'Honda',
        model: 'CB',
        clientId: client.id,
      })),
    );
    const baseTime = Date.parse('2026-01-01T00:00:00.000Z');
    await models.WorkOrder.bulkCreate(
      Array.from({ length: 2400 }, (_, index) => ({
        bikeId: bikes[index % bikes.length].id,
        entryDate: new Date(baseTime + index * 1000),
        faultDescription: `Performance order ${index + 1}`,
        status: index % 2 === 0
          ? WORK_ORDER_STATUS.DELIVERED
          : WORK_ORDER_STATUS.CANCELLED,
        assignedMechanicId: index % 3 === 0 ? mechanic.id : null,
      })),
    );
    await sequelize.query('ANALYZE TABLE bikes, work_orders');

    const [platePlan, allPlan, statusPlan, bikePlan, assigneePlan] = await Promise.all([
      explain('SELECT id FROM bikes WHERE plate = :plate', { plate: 'PERF020' }),
      explain(`SELECT id, bike_id, entry_date, fault_description, status, total,
                      assigned_mechanic_id
               FROM work_orders FORCE INDEX (ix_work_orders_entry_id)
               ORDER BY entry_date DESC, id DESC
               LIMIT 20`),
      explain(`SELECT id, bike_id, entry_date, fault_description, status, total,
                      assigned_mechanic_id
               FROM work_orders
               WHERE status = 'ENTREGADA'
               ORDER BY entry_date DESC, id DESC
               LIMIT 20`),
      explain(`SELECT id, bike_id, entry_date, fault_description, status, total,
                      assigned_mechanic_id
               FROM work_orders
               WHERE bike_id = :bikeId
               ORDER BY entry_date DESC, id DESC
               LIMIT 20`, { bikeId: bikes[0].id }),
      explain(`SELECT id, bike_id, entry_date, fault_description, status, total,
                      assigned_mechanic_id
               FROM work_orders
               WHERE assigned_mechanic_id = :mechanicId
                 AND status = 'ENTREGADA'
               ORDER BY entry_date DESC, id DESC
               LIMIT 20`, { mechanicId: mechanic.id }),
    ]);

    expect(platePlan[0].key).toBe('uq_bikes_plate');
    expect(allPlan[0].key).toBe('ix_work_orders_entry_id');
    expect(statusPlan[0].key).toBe('ix_work_orders_status_entry_id');
    expect(bikePlan[0].key).toBe('ix_work_orders_bike_entry_id');
    expect(assigneePlan[0].key).toBe('ix_work_orders_assignee_status_entry_id');
    for (const plan of [allPlan, statusPlan, bikePlan, assigneePlan]) {
      expect(plan[0].Extra ?? '').not.toContain('Using filesort');
    }
  }, 30000);
});
