import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';

describe('unknown API route', () => {
  it('uses a generic centralized envelope without reflecting path or query data', async () => {
    const response = await request(app)
      .get('/api/unknown/private-path')
      .query({ access_token: 'must-not-be-reflected' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route was not found.',
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /private-path|access_token|must-not-be-reflected/,
    );
  });
});
