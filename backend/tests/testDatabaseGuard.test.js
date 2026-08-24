import { describe, expect, it } from 'vitest';

import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';

describe('test database safety guard', () => {
  it('accepts an isolated database explicitly identified as test', () => {
    expect(() =>
      assertSafeTestDatabase({
        nodeEnv: 'test',
        databaseName: 'pavas_workshop_test',
        developmentDatabaseName: 'pavas_workshop',
      }),
    ).not.toThrow();
  });

  it.each([
    ['production environment', 'production', 'pavas_workshop_test', 'pavas_workshop'],
    ['development environment', 'development', 'pavas_workshop_test', 'pavas_workshop'],
    ['non-test name', 'test', 'pavas_workshop', 'pavas_development'],
    ['development target', 'test', 'pavas_workshop_test', 'pavas_workshop_test'],
  ])('rejects %s', (_case, nodeEnv, databaseName, developmentDatabaseName) => {
    expect(() =>
      assertSafeTestDatabase({
        nodeEnv,
        databaseName,
        developmentDatabaseName,
      }),
    ).toThrow();
  });
});

