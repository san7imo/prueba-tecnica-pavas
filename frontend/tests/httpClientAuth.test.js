import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { httpClient } from '../src/api/httpClient.js';
import {
  clearSession,
  configureRefreshHandler,
  establishSession,
  getSession,
  refreshAccessSession,
} from '../src/features/auth/authSession.js';
import { adminUser } from './testUtils.jsx';

const successfulResponse = (config) => ({
  data: { ok: true },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  request: {},
});

describe('authenticated Axios client', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = httpClient.defaults.adapter;
  });

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
  });

  it('attaches the in-memory access token to business requests', async () => {
    localStorage.clear();
    sessionStorage.clear();
    establishSession({ user: adminUser, accessToken: 'memory-only-token' });
    const adapter = vi.fn(async (config) => successfulResponse(config));

    await httpClient.get('/work-orders', { adapter });

    expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer memory-only-token');
    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it('coordinates five concurrent 401 responses through exactly one refresh', async () => {
    const refresh = vi.fn().mockResolvedValue({ user: adminUser, accessToken: 'rotated-access' });
    configureRefreshHandler(refresh);
    establishSession({ user: adminUser, accessToken: 'expired-access' });
    const retryAdapter = vi.fn(async (config) => successfulResponse(config));
    httpClient.defaults.adapter = retryAdapter;
    const reject401 = httpClient.interceptors.response.handlers[0].rejected;

    const responses = await Promise.all(Array.from({ length: 5 }, (_, index) => reject401({
      response: { status: 401 },
      config: { url: `/work-orders/${index + 1}`, method: 'get', headers: {} },
    })));

    expect(responses).toHaveLength(5);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(retryAdapter).toHaveBeenCalledTimes(5);
    retryAdapter.mock.calls.forEach(([config]) => {
      expect(config.headers.Authorization).toBe('Bearer rotated-access');
      expect(config._authRetried).toBe(true);
    });
  });

  it('does not retry a request that already consumed its one refresh attempt', async () => {
    const refresh = vi.fn();
    configureRefreshHandler(refresh);
    const reject401 = httpClient.interceptors.response.handlers[0].rejected;
    const error = { response: { status: 401 }, config: { _authRetried: true } };

    await expect(reject401(error)).rejects.toBe(error);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears an established session when refresh after a 401 fails', async () => {
    const refreshError = new Error('refresh rejected');
    configureRefreshHandler(vi.fn().mockRejectedValue(refreshError));
    establishSession({ user: adminUser, accessToken: 'expired-access' });
    const retryAdapter = vi.fn();
    httpClient.defaults.adapter = retryAdapter;
    const reject401 = httpClient.interceptors.response.handlers[0].rejected;

    await expect(reject401({
      response: { status: 401 },
      config: { url: '/work-orders', method: 'get', headers: {} },
    })).rejects.toBe(refreshError);

    expect(getSession()).toBeNull();
    expect(retryAdapter).not.toHaveBeenCalled();
  });

  it('does not restore a session when logout wins a race with an in-flight refresh', async () => {
    let resolveRefresh;
    configureRefreshHandler(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const pendingRefresh = refreshAccessSession();
    await Promise.resolve();

    clearSession();
    resolveRefresh({ user: adminUser, accessToken: 'too-late-token' });

    await expect(pendingRefresh).rejects.toThrow(/session changed/i);
    expect(getSession()).toBeNull();
  });
});
