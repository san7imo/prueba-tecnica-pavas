import { env } from '../config/env.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../constants/auth.js';
import { parseDurationMs } from './parseDurationMs.js';

const baseOptions = () => ({
  httpOnly: true,
  secure: env.auth.cookieSecure,
  sameSite: env.auth.cookieSameSite,
  path: REFRESH_COOKIE_PATH,
});

export const refreshCookieOptions = () => ({
  ...baseOptions(),
  maxAge: parseDurationMs(env.auth.refreshExpiresIn, 'JWT_REFRESH_EXPIRES_IN'),
});

export const clearRefreshCookieOptions = () => baseOptions();

export const readRefreshCookie = (request) => {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== 'string') return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === REFRESH_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(separator + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};
