import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { seedInitialAdmin } from '../seeders/seedInitialAdmin.js';
import { app } from '../src/app.js';
import { createMigrator } from '../src/config/migrator.js';
import { env } from '../src/config/env.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { USER_ROLE } from '../src/constants/auth.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { digestRefreshToken } from '../src/utils/authTokens.js';

const PASSWORD = 'Auth-test-password-123';

const cookieValue = (response) => {
  const header = response.headers['set-cookie']?.[0];
  return header?.split(';')[0];
};

const rawCookieToken = (cookie) => decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));

const createUser = async ({
  name = 'Ada Admin',
  email = 'ada@example.test',
  password = PASSWORD,
  role = USER_ROLE.ADMIN,
  active = true,
} = {}) =>
  models.User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, env.auth.bcryptRounds),
    role,
    active,
  });

const login = (email = 'ada@example.test', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

describe.sequential('HITO 7 authentication and refresh tokens', () => {
  let migrator;

  beforeAll(async () => {
    assertSafeTestDatabase({
      nodeEnv: env.nodeEnv,
      databaseName: env.database.name,
      developmentDatabaseName: process.env.DB_NAME,
    });
    await sequelize.authenticate();
    migrator = createMigrator(sequelize);
    await migrator.down({ to: 0 });
    await migrator.up();
  });

  beforeEach(async () => {
    await models.RefreshToken.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    await sequelize.close();
  });

  it('stores normalized users with bcrypt cost >= 10 and safe serialization', async () => {
    const user = await createUser({ email: '  ADA@EXAMPLE.TEST  ' });
    const persisted = await models.User.findByPk(user.id);

    expect(persisted.email).toBe('ada@example.test');
    expect(persisted.passwordHash).not.toBe(PASSWORD);
    expect(persisted.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(Number(persisted.passwordHash.split('$')[2])).toBeGreaterThanOrEqual(10);
    await expect(bcrypt.compare(PASSWORD, persisted.passwordHash)).resolves.toBe(true);
    await expect(bcrypt.compare('wrong-password', persisted.passwordHash)).resolves.toBe(false);
    expect(JSON.stringify(persisted)).not.toContain('password');
  });

  it('seeds one idempotent ADMIN without exposing or storing plaintext', async () => {
    const configuration = {
      name: 'Seed Admin',
      email: '  SEED.ADMIN@EXAMPLE.TEST ',
      password: 'Seed-test-password-123',
    };
    const first = await seedInitialAdmin(configuration);
    const second = await seedInitialAdmin(configuration);
    const users = await models.User.findAll({ where: { email: 'seed.admin@example.test' } });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe(USER_ROLE.ADMIN);
    expect(users[0].passwordHash).not.toBe(configuration.password);
    await expect(bcrypt.compare(configuration.password, users[0].passwordHash)).resolves.toBe(true);
  });

  it.each([USER_ROLE.ADMIN, USER_ROLE.MECHANIC])(
    'logs in a valid %s with minimal access claims and an HttpOnly refresh cookie',
    async (role) => {
      await createUser({ role });
      const response = await login('  ADA@EXAMPLE.TEST  ');

      expect(response.status).toBe(200);
      expect(response.body.data.user).toMatchObject({ email: 'ada@example.test', role, active: true });
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(JSON.stringify(response.body)).not.toMatch(/password|refresh/i);

      const claims = jwt.verify(response.body.data.accessToken, env.auth.accessSecret);
      expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'role', 'sub'].sort());
      expect(claims.role).toBe(role);

      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toContain('pavas_refresh_token=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/auth');
      expect(cookie).toContain('SameSite=Lax');

      const stored = await models.RefreshToken.findOne();
      const rawToken = rawCookieToken(cookieValue(response));
      expect(stored.tokenHash).toBe(digestRefreshToken(rawToken));
      expect(stored.tokenHash).not.toBe(rawToken);
      expect(stored.familyId).toEqual(expect.any(String));
    },
  );

  it('returns one generic error for unknown email, wrong password and inactive user', async () => {
    await createUser({ active: false });
    const responses = await Promise.all([
      login('missing@example.test', PASSWORD),
      login('ada@example.test', 'wrong-password'),
      login('ada@example.test', PASSWORD),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      expect(JSON.stringify(response.body)).not.toMatch(/sql|jwt|passwordHash|password_hash/);
    }
    expect(await models.RefreshToken.count()).toBe(0);
  });

  it('returns the safe current user and rejects missing, malformed and invalid access tokens', async () => {
    const user = await createUser();
    const session = await login();
    const access = session.body.data.accessToken;

    const valid = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${access}`);
    expect(valid.status).toBe(200);
    expect(valid.body.data).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: true,
    });
    expect(JSON.stringify(valid.body)).not.toMatch(/password/i);

    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    for (const authorization of ['Token abc', 'Bearer malformed.jwt']) {
      const invalid = await request(app).get('/api/auth/me').set('Authorization', authorization);
      expect(invalid.status).toBe(401);
      expect(invalid.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    }
  });

  it('rejects expired, wrong-signature, missing-user and inactive-user access tokens', async () => {
    const user = await createUser();
    const expired = jwt.sign({ role: user.role }, env.auth.accessSecret, {
      subject: String(user.id),
      expiresIn: -1,
    });
    const wrongSignature = jwt.sign({ role: user.role }, 'wrong-signature-secret-with-32-characters', {
      subject: String(user.id),
      expiresIn: '15m',
    });
    const missingUser = jwt.sign({ role: user.role }, env.auth.accessSecret, {
      subject: '999999',
      expiresIn: '15m',
    });

    for (const token of [expired, wrongSignature, missingUser]) {
      const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    }

    const session = await login();
    await user.update({ active: false });
    const inactive = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.data.accessToken}`);
    expect(inactive.status).toBe(401);
    expect(inactive.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('enforces access/refresh token purpose and the configured JWT algorithm', async () => {
    const user = await createUser();
    const session = await login();
    const accessToken = session.body.data.accessToken;
    const refreshCookie = cookieValue(session);
    const refreshToken = rawCookieToken(refreshCookie);
    const wrongAlgorithm = jwt.sign({ role: user.role }, env.auth.accessSecret, {
      algorithm: 'HS384',
      subject: String(user.id),
      expiresIn: '15m',
    });

    const accessAsRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `pavas_refresh_token=${accessToken}`);
    expect(accessAsRefresh.status).toBe(401);
    expect(accessAsRefresh.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    for (const token of [refreshToken, wrongAlgorithm]) {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    }
  });

  it('preserves credentialed CORS through login, refresh, business API and logout', async () => {
    await createUser();
    const origin = env.frontendOrigin;
    const session = await login().set('Origin', origin);
    expect(session.status).toBe(200);
    expect(session.headers['access-control-allow-origin']).toBe(origin);
    expect(session.headers['access-control-allow-credentials']).toBe('true');

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', cookieValue(session));
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers['access-control-allow-origin']).toBe(origin);

    const business = await request(app)
      .get('/api/clients')
      .set('Origin', origin)
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
    expect(business.status).toBe(200);
    expect(business.headers['access-control-allow-origin']).toBe(origin);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookieValue(refreshed));
    expect(logout.status).toBe(200);
    expect(logout.headers['access-control-allow-origin']).toBe(origin);
    expect(logout.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rotates a valid refresh token transactionally in the same family', async () => {
    await createUser();
    const session = await login();
    const oldCookie = cookieValue(session);
    const oldRaw = rawCookieToken(oldCookie);
    const oldRecord = await models.RefreshToken.findOne({
      where: { tokenHash: digestRefreshToken(oldRaw) },
    });

    const response = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toMatch(/refresh|password/i);
    const newCookie = cookieValue(response);
    expect(newCookie).not.toBe(oldCookie);

    await oldRecord.reload();
    const replacement = await models.RefreshToken.findByPk(oldRecord.replacedByTokenId);
    expect(oldRecord.revokedAt).toBeInstanceOf(Date);
    expect(replacement.familyId).toBe(oldRecord.familyId);
    expect(replacement.revokedAt).toBeNull();
    expect(replacement.tokenHash).toBe(digestRefreshToken(rawCookieToken(newCookie)));
  });

  it('rejects absent, invalid and expired refresh tokens without creating replacements', async () => {
    const user = await createUser();
    const familyId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const expiredRaw = jwt.sign(
      { familyId, type: 'refresh' },
      env.auth.refreshSecret,
      { subject: String(user.id), expiresIn: -1 },
    );
    await models.RefreshToken.create({
      userId: user.id,
      familyId,
      tokenHash: digestRefreshToken(expiredRaw),
      expiresAt: new Date(Date.now() - 1000),
    });

    for (const cookie of [undefined, 'pavas_refresh_token=invalid.jwt', `pavas_refresh_token=${expiredRaw}`]) {
      const call = request(app).post('/api/auth/refresh');
      if (cookie) call.set('Cookie', cookie);
      const response = await call;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    }
    expect(await models.RefreshToken.count()).toBe(1);
  });

  it('detects rotated-token reuse, revokes that family and rejects its replacement', async () => {
    await createUser();
    const session = await login();
    const tokenA = cookieValue(session);
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', tokenA);
    const tokenB = cookieValue(rotated);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', tokenA);
    expect(replay.status).toBe(401);
    const family = (await models.RefreshToken.findOne()).familyId;
    expect(await models.RefreshToken.count({ where: { familyId: family, revokedAt: null } })).toBe(0);

    const replacementAttempt = await request(app).post('/api/auth/refresh').set('Cookie', tokenB);
    expect(replacementAttempt.status).toBe(401);
  });

  it('keeps an independent login family usable after replay in another family', async () => {
    await createUser();
    const browserX = await login();
    const browserY = await login();
    const tokenX = cookieValue(browserX);
    const tokenY = cookieValue(browserY);
    const rotatedX = await request(app).post('/api/auth/refresh').set('Cookie', tokenX);
    await request(app).post('/api/auth/refresh').set('Cookie', tokenX).expect(401);

    const familyX = (
      await models.RefreshToken.findOne({ where: { tokenHash: digestRefreshToken(rawCookieToken(tokenX)) } })
    ).familyId;
    const familyY = (
      await models.RefreshToken.findOne({ where: { tokenHash: digestRefreshToken(rawCookieToken(tokenY)) } })
    ).familyId;
    expect(familyX).not.toBe(familyY);
    expect(await models.RefreshToken.count({ where: { familyId: familyX, revokedAt: null } })).toBe(0);
    expect(cookieValue(rotatedX)).toBeDefined();

    const refreshY = await request(app).post('/api/auth/refresh').set('Cookie', tokenY);
    expect(refreshY.status).toBe(200);
    expect(await models.RefreshToken.count({ where: { familyId: familyY, revokedAt: null } })).toBe(1);
  });

  it('logs out only the current session, clears the cookie and remains idempotent', async () => {
    await createUser();
    const current = await login();
    const independent = await login();
    const currentCookie = cookieValue(current);
    const independentCookie = cookieValue(independent);

    const first = await request(app).post('/api/auth/logout').set('Cookie', currentCookie);
    expect(first.status).toBe(200);
    expect(first.body.data.loggedOut).toBe(true);
    const clearedCookie = first.headers['set-cookie'][0];
    expect(clearedCookie).toContain('pavas_refresh_token=;');
    expect(clearedCookie).toContain('HttpOnly');
    expect(clearedCookie).toContain('Path=/api/auth');
    expect(clearedCookie).toContain('SameSite=Lax');
    expect(clearedCookie).not.toContain('Secure');
    await request(app).post('/api/auth/refresh').set('Cookie', currentCookie).expect(401);

    const second = await request(app).post('/api/auth/logout').set('Cookie', currentCookie);
    expect(second.status).toBe(200);
    await request(app).post('/api/auth/logout').expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', independentCookie).expect(200);
  });

  it('serializes concurrent refreshes so only one rotates and replay leaves no active descendant', async () => {
    await createUser();
    const session = await login();
    const tokenA = cookieValue(session);
    const original = await models.RefreshToken.findOne();

    const responses = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', tokenA),
      request(app).post('/api/auth/refresh').set('Cookie', tokenA),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);

    const familyRows = await models.RefreshToken.findAll({ where: { familyId: original.familyId } });
    expect(familyRows).toHaveLength(2);
    expect(familyRows.filter((token) => token.revokedAt === null)).toHaveLength(0);
    expect(familyRows.filter((token) => token.replacedByTokenId !== null)).toHaveLength(1);
  });

  it('rate limits the login endpoint with a stable 429 envelope', async () => {
    let response;
    for (let attempt = 0; attempt < 110; attempt += 1) {
      response = await request(app).post('/api/auth/login').send({});
      if (response.status === 429) break;
    }
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: {
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many login attempts. Try again later.',
      },
    });
  });
});
