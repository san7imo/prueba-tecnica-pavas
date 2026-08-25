import { sequelize } from '../src/config/databaseContext.js';
import { env } from '../src/config/env.js';
import { seedDemoData } from '../seeders/seedDemoData.js';

try {
  if (!['development', 'test'].includes(env.nodeEnv)) {
    throw new Error('Demo data seed is allowed only in development or test environments.');
  }
  await sequelize.authenticate();
  const result = await seedDemoData();

  if (!result.created) {
    console.log('Demo data already exists; no changes were made.');
  } else {
    const { counts, statusDistribution } = result;
    console.log(
      `Demo data created: ${counts.clients} clients, ${counts.bikes} bikes, ` +
        `${counts.workOrders} work orders, ${counts.items} items, ` +
        `${counts.history} history rows and ${counts.users} mechanics.`,
    );
    console.log(`Status distribution: ${JSON.stringify(statusDistribution)}`);
  }
} catch (error) {
  console.error(`Demo data seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
