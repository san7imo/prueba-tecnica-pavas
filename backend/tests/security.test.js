import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { securityHeaderOptions } from '../src/config/securityHeaders.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

describe('HITO 11 HTTP security controls', () => {
  it('enables the bounded HSTS policy only for production', () => {
    expect(securityHeaderOptions({ nodeEnv: 'test' }).strictTransportSecurity).toBe(false);
    expect(securityHeaderOptions({ nodeEnv: 'production' }).strictTransportSecurity).toEqual({
      maxAge: 31536000,
      includeSubDomains: false,
      preload: false,
    });
  });

  it('sets the selected API security headers without advertising Express', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the exact configured origin with credentials and varies by Origin', async () => {
    const response = await request(app).get('/api/health').set('Origin', env.frontendOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(env.frontendOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toContain('Origin');
  });

  it('denies an unconfigured origin with a safe 403 response', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'https://evil.example');

    expect(response.status).toBe(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).toEqual({
      error: {
        code: 'CORS_ORIGIN_DENIED',
        message: 'Origin is not allowed by the CORS policy.',
      },
    });
  });

  it('permits non-browser requests without an Origin header', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers allowed credentialed preflight requests explicitly', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', env.frontendOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(env.frontendOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
  });

  it('maps malformed and oversized JSON to safe client errors', async () => {
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.' },
    });

    const oversized = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(110 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the allowed size.' },
    });
  });

  it('sanitizes unexpected exceptions without leaking implementation details', async () => {
    const isolatedApp = express();
    isolatedApp.get('/failure', (_request, _response, next) => {
      next(new Error('SQL password_hash failed at /srv/private/database.js'));
    });
    isolatedApp.use(errorHandler);

    const response = await request(isolatedApp).get('/failure');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/sql|password|\/srv|stack/i);
  });
});
