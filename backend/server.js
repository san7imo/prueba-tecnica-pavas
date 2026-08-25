import { app } from './src/app.js';
import { validateApplicationConfiguration } from './src/config/applicationConfig.js';
import { sequelize } from './src/config/databaseContext.js';
import { env } from './src/config/env.js';

let server;

const start = async () => {
  try {
    validateApplicationConfiguration();
  } catch (error) {
    console.error(`PAVAS API did not start: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    await sequelize.authenticate();
    server = app.listen(env.port, () => {
      console.log(`PAVAS API listening on port ${env.port}`);
    });
  } catch {
    console.error('PAVAS API did not start: database initialization failed.');
    await sequelize.close();
    process.exitCode = 1;
  }
};

const shutdown = async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await sequelize.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void start();
