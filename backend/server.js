import { app } from './src/app.js';
import { sequelize } from './src/config/databaseContext.js';
import { env } from './src/config/env.js';

let server;

const start = async () => {
  try {
    await sequelize.authenticate();
    server = app.listen(env.port, () => {
      console.log(`PAVAS API listening on port ${env.port}`);
    });
  } catch {
    console.error('PAVAS API could not connect to MySQL and did not start.');
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
