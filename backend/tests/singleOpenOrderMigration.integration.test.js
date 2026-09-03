import { QueryTypes, UniqueConstraintError } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';

const PREVIOUS_MIGRATION = '202609030012-normalize-client-contacts.js';
const timestamp = new Date('2026-09-03T15:00:00.000Z');

describe.sequential('Single-open-order migration', () => {
  let sequelize;
  let migrator;
  let bikeId;

  const insertOrder = (status, faultDescription) =>
    sequelize.query(
      `INSERT INTO work_orders
         (bike_id, entry_date, fault_description, status, total, created_at, updated_at)
       VALUES
         (:bikeId, :timestamp, :faultDescription, :status, '0.00', :timestamp, :timestamp)`,
      {
        type: QueryTypes.INSERT,
        replacements: { bikeId, timestamp, faultDescription, status },
      },
    );

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
    await migrator.up({ to: PREVIOUS_MIGRATION });

    const [clientId] = await sequelize.query(
      `INSERT INTO clients (name, phone, email, created_at, updated_at)
       VALUES ('Migration Client', '3001234567', 'migration@example.test', :timestamp, :timestamp)`,
      { type: QueryTypes.INSERT, replacements: { timestamp } },
    );
    [bikeId] = await sequelize.query(
      `INSERT INTO bikes
         (plate, brand, model, client_id, created_at, updated_at)
       VALUES ('MIG001', 'Honda', 'CB', :clientId, :timestamp, :timestamp)`,
      { type: QueryTypes.INSERT, replacements: { clientId, timestamp } },
    );
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    if (sequelize) await sequelize.close();
  });

  it('aborts with bike/count diagnostics and does not alter inconsistent data', async () => {
    await insertOrder('RECIBIDA', 'First open order.');
    await insertOrder('DIAGNOSTICO', 'Second open order.');

    await expect(migrator.up()).rejects.toThrow(
      new RegExp(`bike ${bikeId} \\(2 open orders\\)`),
    );
    expect(await migrator.executed()).toHaveLength(12);

    const [columns] = await sequelize.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'work_orders'
         AND COLUMN_NAME = 'open_bike_id'`,
    );
    expect(columns).toEqual([]);
    const [rows] = await sequelize.query(
      'SELECT status FROM work_orders WHERE bike_id = :bikeId ORDER BY id ASC',
      { replacements: { bikeId } },
    );
    expect(rows.map(({ status }) => status)).toEqual(['RECIBIDA', 'DIAGNOSTICO']);
  });

  it('applies after human correction and enforces the invariant at database level', async () => {
    await sequelize.query(
      `UPDATE work_orders
       SET status = 'ENTREGADA'
       WHERE bike_id = :bikeId AND status = 'DIAGNOSTICO'`,
      { replacements: { bikeId } },
    );

    await expect(migrator.up()).resolves.toHaveLength(1);
    expect(await migrator.executed()).toHaveLength(13);

    const [columnRows] = await sequelize.query(
      `SELECT EXTRA, GENERATION_EXPRESSION
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'work_orders'
         AND COLUMN_NAME = 'open_bike_id'`,
    );
    expect(columnRows).toHaveLength(1);
    expect(columnRows[0].EXTRA).toContain('STORED GENERATED');
    expect(columnRows[0].GENERATION_EXPRESSION).toContain('bike_id');

    await expect(
      insertOrder('EN_PROCESO', 'Constraint violation.'),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
    await expect(
      insertOrder('CANCELADA', 'Allowed closed history.'),
    ).resolves.toBeDefined();
  });
});
