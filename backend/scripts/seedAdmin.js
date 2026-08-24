import { sequelize } from '../src/config/databaseContext.js';
import { seedInitialAdmin } from '../seeders/seedInitialAdmin.js';

try {
  await sequelize.authenticate();
  const result = await seedInitialAdmin();
  console.log(result.created ? 'Initial ADMIN created.' : 'Initial ADMIN already exists.');
} catch (error) {
  console.error(`Initial ADMIN seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
