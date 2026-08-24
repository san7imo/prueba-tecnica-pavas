import { describe, expect, it } from 'vitest';

import { validateAuthConfiguration } from '../src/config/authConfig.js';
import { env } from '../src/config/env.js';
import { parseDurationMs } from '../src/utils/parseDurationMs.js';

const valid = () => ({
  nodeEnv: 'production',
  auth: {
    accessSecret: 'production-access-value-12345678901234567890',
    refreshSecret: 'production-refresh-value-0987654321098765432',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    cookieSecure: true,
    cookieSameSite: 'lax',
  },
});

describe('authentication configuration', () => {
  it('accepts the configured test environment and parses supported durations', () => {
    expect(() => validateAuthConfiguration(env)).not.toThrow();
    expect(parseDurationMs('15m')).toBe(900000);
    expect(parseDurationMs('7d')).toBe(604800000);
  });

  it('rejects weak, shared and example production secrets', () => {
    const weak = valid();
    weak.auth.accessSecret = 'short';
    expect(() => validateAuthConfiguration(weak)).toThrow(/JWT_ACCESS_SECRET/);

    const shared = valid();
    shared.auth.refreshSecret = shared.auth.accessSecret;
    expect(() => validateAuthConfiguration(shared)).toThrow(/must be different/);

    const example = valid();
    example.auth.accessSecret = 'replace_with_a_long_random_secret_123456';
    expect(() => validateAuthConfiguration(example)).toThrow(/example value/);
  });

  it('rejects unsafe production cookie and lifetime combinations', () => {
    const insecure = valid();
    insecure.auth.cookieSecure = false;
    expect(() => validateAuthConfiguration(insecure)).toThrow(/COOKIE_SECURE/);

    const sameSiteNone = valid();
    sameSiteNone.nodeEnv = 'development';
    sameSiteNone.auth.cookieSecure = false;
    sameSiteNone.auth.cookieSameSite = 'none';
    expect(() => validateAuthConfiguration(sameSiteNone)).toThrow(/SAME_SITE=none/i);

    const shortRefresh = valid();
    shortRefresh.auth.refreshExpiresIn = '5m';
    expect(() => validateAuthConfiguration(shortRefresh)).toThrow(/must be longer/);
  });
});
