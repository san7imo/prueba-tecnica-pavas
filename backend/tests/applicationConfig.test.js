import { describe, expect, it } from 'vitest';

import { validateApplicationConfiguration } from '../src/config/applicationConfig.js';
import { env } from '../src/config/env.js';

const valid = () => ({
  nodeEnv: 'production',
  frontendOrigin: 'https://workshop.example.com',
  auth: {
    accessSecret: 'production-access-value-12345678901234567890',
    refreshSecret: 'production-refresh-value-0987654321098765432',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    cookieSecure: true,
    cookieSameSite: 'lax',
  },
});

describe('application configuration', () => {
  it('accepts the complete test configuration', () => {
    expect(() => validateApplicationConfiguration(env)).not.toThrow();
  });

  it('rejects unsupported environments and missing or non-origin frontend values', () => {
    const unsupported = valid();
    unsupported.nodeEnv = 'staging';
    expect(() => validateApplicationConfiguration(unsupported)).toThrow(/NODE_ENV/);

    for (const frontendOrigin of ['', '*', 'workshop.example.com', 'https://workshop.example.com/app']) {
      const configuration = valid();
      configuration.frontendOrigin = frontendOrigin;
      expect(() => validateApplicationConfiguration(configuration)).toThrow(/FRONTEND_ORIGIN/);
    }
  });

  it('requires an HTTPS frontend origin in production', () => {
    const configuration = valid();
    configuration.frontendOrigin = 'http://workshop.example.com';

    expect(() => validateApplicationConfiguration(configuration)).toThrow(/HTTPS/);
  });
});
