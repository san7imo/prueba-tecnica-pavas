import { app } from './src/app.js';
import { env } from './src/config/env.js';

const server = app.listen(env.port, () => {
  console.log(`PAVAS API listening on port ${env.port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

