import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const parsePort = (value, fallback) => {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
};

const parseInteger = ({ value, fallback, name, minimum, maximum }) => {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
};

const parseBoolean = (value, fallback) => {
  const normalized = String(value ?? fallback).toLowerCase();
  if (!['true', 'false'].includes(normalized)) {
    throw new Error('COOKIE_SECURE must be true or false.');
  }
  return normalized === 'true';
};

const parseSameSite = (value) => {
  const normalized = String(value ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(normalized)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict or none.');
  }
  return normalized;
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
  auth: Object.freeze({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    bcryptRounds: parseInteger({
      value: process.env.BCRYPT_ROUNDS,
      fallback: 12,
      name: 'BCRYPT_ROUNDS',
      minimum: 10,
      maximum: 15,
    }),
    cookieSecure: parseBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production'),
    cookieSameSite: parseSameSite(process.env.COOKIE_SAME_SITE),
    loginRateLimitWindowMs: parseInteger({
      value: process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
      fallback: 900000,
      name: 'LOGIN_RATE_LIMIT_WINDOW_MS',
      minimum: 1000,
      maximum: 86400000,
    }),
    loginRateLimitMax: parseInteger({
      value: process.env.LOGIN_RATE_LIMIT_MAX,
      fallback: 10,
      name: 'LOGIN_RATE_LIMIT_MAX',
      minimum: 1,
      maximum: 10000,
    }),
  }),
  adminSeed: Object.freeze({
    name: process.env.ADMIN_SEED_NAME ?? '',
    email: process.env.ADMIN_SEED_EMAIL ?? '',
    password: process.env.ADMIN_SEED_PASSWORD ?? '',
  }),
});
