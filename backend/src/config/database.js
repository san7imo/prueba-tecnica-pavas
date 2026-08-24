import { Sequelize } from 'sequelize';

import { env } from './env.js';

export const createSequelize = () =>
  new Sequelize(env.database.name, env.database.username, env.database.password, {
    dialect: 'mysql',
    host: env.database.host,
    port: env.database.port,
    logging: false,
    define: {
      underscored: true,
      freezeTableName: true,
    },
  });

