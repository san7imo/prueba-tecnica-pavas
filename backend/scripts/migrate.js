import { createSequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';

const command = process.argv[2] ?? 'up';
const sequelize = createSequelize();
const migrator = createMigrator(sequelize, { logger: console });

const requireSafeTestTarget = () =>
  assertSafeTestDatabase({
    nodeEnv: env.nodeEnv,
    databaseName: env.database.name,
    developmentDatabaseName: process.env.DB_NAME ?? 'pavas_workshop',
  });

try {
  await sequelize.authenticate();

  if (command === 'up') {
    await migrator.up();
  } else if (command === 'down') {
    await migrator.down();
  } else if (command === 'reset') {
    requireSafeTestTarget();
    await migrator.down({ to: 0 });
  } else if (command === 'status') {
    const [executed, pending] = await Promise.all([
      migrator.executed(),
      migrator.pending(),
    ]);

    console.log('Executed migrations:', executed.map(({ name }) => name));
    console.log('Pending migrations:', pending.map(({ name }) => name));
  } else {
    throw new Error(`Unknown migration command: ${command}`);
  }
} finally {
  await sequelize.close();
}

