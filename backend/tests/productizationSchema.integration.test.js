import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';

const BASELINE_LAST_MIGRATION =
  '202608240007-create-work-order-status-history.js';

describe.sequential('Productization persistence migrations', () => {
  let sequelize;
  let migrator;

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
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    if (sequelize) await sequelize.close();
  });

  it('preserves populated baseline rows through up, down and reapply', async () => {
    const baseline = await migrator.up({ to: BASELINE_LAST_MIGRATION });
    expect(baseline).toHaveLength(7);

    const timestamp = new Date('2026-09-03T15:00:00.000Z');
    const [userId] = await sequelize.query(
      `INSERT INTO users
         (name, email, password_hash, role, active, created_at, updated_at)
       VALUES
         (:name, :email, :passwordHash, 'ADMIN', 1, :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          name: 'Legacy Admin',
          email: 'legacy.admin@example.test',
          passwordHash: '$2b$10$test-only-not-a-real-password-hash-value-123456789',
          timestamp,
        },
      },
    );
    const [clientId] = await sequelize.query(
      `INSERT INTO clients (name, phone, email, created_at, updated_at)
       VALUES (:name, :phone, :email, :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          name: 'Legacy Client',
          phone: '3001234567',
          email: 'legacy.client@example.test',
          timestamp,
        },
      },
    );
    const [bikeId] = await sequelize.query(
      `INSERT INTO bikes
         (plate, brand, model, cylinder, client_id, created_at, updated_at)
       VALUES
         ('LEG001', 'Yamaha', 'FZ', '150', :clientId, :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: { clientId, timestamp },
      },
    );
    const [workOrderId] = await sequelize.query(
      `INSERT INTO work_orders
         (bike_id, entry_date, fault_description, status, total, created_at, updated_at)
       VALUES
         (:bikeId, :timestamp, 'Legacy fault', 'RECIBIDA', '1000.00', :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: { bikeId, timestamp },
      },
    );
    const [itemId] = await sequelize.query(
      `INSERT INTO work_order_items
         (work_order_id, type, description, count, unit_value, created_at, updated_at)
       VALUES
         (:workOrderId, 'MANO_OBRA', 'Legacy item', '1.00', '1000.00', :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: { workOrderId, timestamp },
      },
    );

    expect(userId).toEqual(expect.any(Number));
    expect(itemId).toEqual(expect.any(Number));

    const foundations = await migrator.up();
    expect(foundations).toHaveLength(5);

    const [migratedRows] = await sequelize.query(
      `SELECT
         c.name,
         c.deleted_at,
         c.deleted_by_user_id,
         c.delete_reason,
         b.plate,
         b.deleted_at AS bike_deleted_at,
         wo.assigned_mechanic_id,
         woi.created_by_user_id
       FROM clients c
       JOIN bikes b ON b.client_id = c.id
       JOIN work_orders wo ON wo.bike_id = b.id
       JOIN work_order_items woi ON woi.work_order_id = wo.id
       WHERE c.id = :clientId`,
      { replacements: { clientId } },
    );
    expect(migratedRows).toEqual([
      expect.objectContaining({
        name: 'Legacy Client',
        plate: 'LEG001',
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        bike_deleted_at: null,
        assigned_mechanic_id: null,
        created_by_user_id: null,
      }),
    ]);

    const reverted = await migrator.down({ step: 5 });
    expect(reverted).toHaveLength(5);
    expect(await migrator.executed()).toHaveLength(7);
    const [legacyStillPresent] = await sequelize.query(
      `SELECT c.name, b.plate, wo.fault_description, woi.description
       FROM clients c
       JOIN bikes b ON b.client_id = c.id
       JOIN work_orders wo ON wo.bike_id = b.id
       JOIN work_order_items woi ON woi.work_order_id = wo.id
       WHERE c.id = :clientId`,
      { replacements: { clientId } },
    );
    expect(legacyStillPresent).toEqual([
      expect.objectContaining({
        name: 'Legacy Client',
        plate: 'LEG001',
        fault_description: 'Legacy fault',
        description: 'Legacy item',
      }),
    ]);

    const reapplied = await migrator.up();
    expect(reapplied).toHaveLength(5);
    expect(await migrator.executed()).toHaveLength(12);
  }, 30000);
});
