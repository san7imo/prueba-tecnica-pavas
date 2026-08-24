import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SequelizeStorage, Umzug } from 'umzug';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(currentDirectory, '../../migrations');

export const createMigrator = (sequelize, { logger } = {}) =>
  new Umzug({
    migrations: {
      glob: ['*.js', { cwd: migrationsDirectory }],
      resolve: ({ name, path, context }) => ({
        name,
        up: async () => {
          const migration = await import(pathToFileURL(path).href);
          return migration.up({ context });
        },
        down: async () => {
          const migration = await import(pathToFileURL(path).href);
          return migration.down({ context });
        },
      }),
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize,
      tableName: 'SequelizeMeta',
    }),
    logger,
  });
