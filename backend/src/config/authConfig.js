import { env } from './env.js';
import { parseDurationMs } from '../utils/parseDurationMs.js';

const PLACEHOLDER_MARKERS = ['replace_', 'change_me', 'example', 'secret'];

const assertSecret = (value, name, nodeEnv) => {
  if (typeof value !== 'string' || value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters.`);
  }

  if (
    nodeEnv === 'production' &&
    PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker))
  ) {
    throw new Error(`${name} must not use an example value in production.`);
  }
};

export const validateAuthConfiguration = (configuration = env) => {
  const { auth, nodeEnv } = configuration;
  assertSecret(auth.accessSecret, 'JWT_ACCESS_SECRET', nodeEnv);
  assertSecret(auth.refreshSecret, 'JWT_REFRESH_SECRET', nodeEnv);

  if (auth.accessSecret === auth.refreshSecret) {
    throw new Error('JWT access and refresh secrets must be different.');
  }

  const accessMs = parseDurationMs(auth.accessExpiresIn, 'JWT_ACCESS_EXPIRES_IN');
  const refreshMs = parseDurationMs(auth.refreshExpiresIn, 'JWT_REFRESH_EXPIRES_IN');

  if (refreshMs <= accessMs) {
    throw new Error('JWT_REFRESH_EXPIRES_IN must be longer than JWT_ACCESS_EXPIRES_IN.');
  }

  if (nodeEnv === 'production' && !auth.cookieSecure) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }

  if (auth.cookieSameSite === 'none' && !auth.cookieSecure) {
    throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.');
  }
};
