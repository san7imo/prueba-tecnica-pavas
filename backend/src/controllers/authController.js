import { REFRESH_COOKIE_NAME } from '../constants/auth.js';
import { authService } from '../services/authService.js';
import {
  clearRefreshCookieOptions,
  readRefreshCookie,
  refreshCookieOptions,
} from '../utils/authCookie.js';

export const login = async (request, response) => {
  const result = await authService.login(request.validated.body);
  response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
  response.json({ data: { user: result.user, accessToken: result.accessToken } });
};

export const refresh = async (request, response) => {
  const result = await authService.refresh(readRefreshCookie(request));
  response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
  response.json({ data: { user: result.user, accessToken: result.accessToken } });
};

export const logout = async (request, response) => {
  await authService.logout(readRefreshCookie(request));
  response.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
  response.json({ data: { loggedOut: true } });
};

export const me = async (request, response) => {
  response.json({ data: request.user });
};
