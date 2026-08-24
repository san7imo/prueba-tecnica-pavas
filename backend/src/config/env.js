import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const parsePort = (value, fallback) => {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = Object.freeze({
  nodeEnv,
  port: parsePort(process.env.PORT, 3000),
  database: Object.freeze({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parsePort(process.env.DB_PORT, 3306),
    name:
      nodeEnv === 'test'
        ? (process.env.DB_NAME_TEST ?? 'pavas_workshop_test')
        : (process.env.DB_NAME ?? 'pavas_workshop'),
    username: process.env.DB_USER ?? 'pavas',
    password: process.env.DB_PASSWORD ?? '',
  }),
});
