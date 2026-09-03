import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';

const PREVIOUS_MIGRATION = '202609030011-add-work-order-item-creator.js';
const CONTACT_MIGRATION = '202609030012-normalize-client-contacts.js';

describe.sequential('Client contact canonicalization migration', () => {
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
  });

  beforeEach(async () => {
    await migrator.down({ to: 0 });
    await migrator.up({ to: PREVIOUS_MIGRATION });
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    if (sequelize) await sequelize.close();
  });

  it('canonicalizes valid persisted contacts and reapplies idempotently', async () => {
    const timestamp = new Date('2026-09-03T12:00:00.000Z');
    await sequelize.query(
      `INSERT INTO clients (name, phone, email, created_at, updated_at)
       VALUES
         ('Formatted', ' +57 (300) 123-45.67 ', '  PERSON@EXAMPLE.TEST ', :timestamp, :timestamp),
         ('No email', '300.765.4321', NULL, :timestamp, :timestamp)`,
      { replacements: { timestamp } },
    );
    const beforeTimestamps = await sequelize.query(
      'SELECT updated_at FROM clients ORDER BY id ASC',
      { type: QueryTypes.SELECT },
    );

    const applied = await migrator.up({ to: CONTACT_MIGRATION });
    expect(applied).toHaveLength(1);
    const contacts = await sequelize.query(
      'SELECT name, phone, email, updated_at FROM clients ORDER BY id ASC',
      { type: QueryTypes.SELECT },
    );
    expect(contacts).toEqual([
      expect.objectContaining({
        name: 'Formatted',
        phone: '+573001234567',
        email: 'person@example.test',
        updated_at: beforeTimestamps[0].updated_at,
      }),
      expect.objectContaining({
        name: 'No email',
        phone: '3007654321',
        email: null,
        updated_at: beforeTimestamps[1].updated_at,
      }),
    ]);

    expect(await migrator.down({ step: 1 })).toHaveLength(1);
    expect(await migrator.up({ to: CONTACT_MIGRATION })).toHaveLength(1);
    const reapplied = await sequelize.query(
      'SELECT phone, email FROM clients ORDER BY id ASC',
      { type: QueryTypes.SELECT },
    );
    expect(reapplied).toEqual([
      { phone: '+573001234567', email: 'person@example.test' },
      { phone: '3007654321', email: null },
    ]);
  });

  it('aborts before changing any row and reports only ids/invalid fields', async () => {
    const timestamp = new Date('2026-09-03T12:00:00.000Z');
    const [invalidPhoneId] = await sequelize.query(
      `INSERT INTO clients (name, phone, email, created_at, updated_at)
       VALUES ('Bad phone', 'private-phone-value', ' UPPER@EXAMPLE.TEST ', :timestamp, :timestamp)`,
      { type: QueryTypes.INSERT, replacements: { timestamp } },
    );
    const [invalidEmailId] = await sequelize.query(
      `INSERT INTO clients (name, phone, email, created_at, updated_at)
       VALUES ('Bad email', '300-123-4567', 'private invalid email', :timestamp, :timestamp)`,
      { type: QueryTypes.INSERT, replacements: { timestamp } },
    );

    let migrationError;
    try {
      await migrator.up({ to: CONTACT_MIGRATION });
    } catch (error) {
      migrationError = error;
    }
    expect(migrationError).toBeDefined();
    expect(migrationError.message).toContain(
      `client ${invalidPhoneId} [phone]`,
    );
    expect(migrationError.message).toContain(
      `client ${invalidEmailId} [email]`,
    );
    expect(migrationError.message).not.toContain('private-phone-value');
    expect(migrationError.message).not.toContain('private invalid email');
    expect((await migrator.executed()).map(({ name }) => name)).not.toContain(
      CONTACT_MIGRATION,
    );

    const unchanged = await sequelize.query(
      'SELECT id, phone, email FROM clients ORDER BY id ASC',
      { type: QueryTypes.SELECT },
    );
    expect(unchanged).toEqual([
      {
        id: invalidPhoneId,
        phone: 'private-phone-value',
        email: ' UPPER@EXAMPLE.TEST ',
      },
      {
        id: invalidEmailId,
        phone: '300-123-4567',
        email: 'private invalid email',
      },
    ]);
  });
});
