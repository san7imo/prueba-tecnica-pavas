import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { env } from '../src/config/env.js';
import { USER_ROLE } from '../src/constants/auth.js';
import { WORK_ORDER_ITEM_TYPE, WORK_ORDER_STATUS } from '../src/constants/workOrder.js';

const PASSWORD = 'Rbac-test-password-123';

const bearer = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

const createUser = async ({ name, email, role, active = true }) =>
  models.User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(PASSWORD, env.auth.bcryptRounds),
    role,
    active,
  });

const login = async (email) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.data.accessToken;
};

const registerPayload = (overrides = {}) => ({
  name: 'New Mechanic',
  email: 'new.mechanic@example.test',
  password: 'Register-password-123',
  role: USER_ROLE.MECHANIC,
  ...overrides,
});

describe.sequential('HITO 8 role-based access control', () => {
  let migrator;
  let admin;
  let mechanic;
  let adminAccessToken;
  let mechanicAccessToken;

  const adminHeaders = () => bearer(adminAccessToken);
  const mechanicHeaders = () => bearer(mechanicAccessToken);

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
    await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
    await models.WorkOrderItem.destroy({ where: {}, force: true });
    await models.WorkOrder.destroy({ where: {}, force: true });
    await models.Bike.destroy({ where: {}, force: true });
    await models.Client.destroy({ where: {}, force: true });
    await models.RefreshToken.destroy({ where: {}, force: true });
    await models.User.destroy({ where: {}, force: true });

    admin = await createUser({
      name: 'RBAC Admin',
      email: 'rbac.admin@example.test',
      role: USER_ROLE.ADMIN,
    });
    mechanic = await createUser({
      name: 'RBAC Mechanic',
      email: 'rbac.mechanic@example.test',
      role: USER_ROLE.MECHANIC,
    });
    adminAccessToken = await login(admin.email);
    mechanicAccessToken = await login(mechanic.email);
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    await sequelize.close();
  });

  it('returns 401 before validation for missing, malformed and inactive-user tokens', async () => {
    const missing = await request(app).post('/api/clients').send({});
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const malformed = await request(app)
      .get('/api/bikes/not-an-id')
      .set('Authorization', 'Bearer invalid.jwt');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('INVALID_ACCESS_TOKEN');

    await mechanic.update({ active: false });
    const inactive = await request(app)
      .get('/api/work-orders')
      .set(mechanicHeaders());
    expect(inactive.status).toBe(401);
    expect(inactive.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('allows ADMIN and MECANICO to create and read clients, bikes and work orders', async () => {
    for (const [index, headers] of [adminHeaders(), mechanicHeaders()].entries()) {
      const clientResponse = await request(app)
        .post('/api/clients')
        .set(headers)
        .send({
          name: `Business Client ${index}`,
          phone: `300000000${index}`,
          email: `business.client.${index}@example.test`,
        });
      expect(clientResponse.status).toBe(201);
      await request(app).get('/api/clients').set(headers).expect(200);

      const bikeResponse = await request(app)
        .post('/api/bikes')
        .set(headers)
        .send({
          plate: `RB${index}001`,
          brand: 'Honda',
          model: 'CB',
          clientId: clientResponse.body.data.id,
        });
      expect(bikeResponse.status).toBe(201);
      await request(app).get(`/api/bikes/${bikeResponse.body.data.id}`).set(headers).expect(200);

      const orderResponse = await request(app)
        .post('/api/work-orders')
        .set(headers)
        .send({
          bikeId: bikeResponse.body.data.id,
          faultDescription: 'RBAC business access test.',
        });
      expect(orderResponse.status).toBe(201);
      await request(app)
        .get(`/api/work-orders/${orderResponse.body.data.id}`)
        .set(headers)
        .expect(200);
    }
  });

  it('allows both roles to add items but only ADMIN to delete them', async () => {
    const client = await models.Client.create({ name: 'Item Client', phone: '3001234567' });
    const bike = await models.Bike.create({
      plate: 'ITM001',
      brand: 'Yamaha',
      model: 'FZ',
      clientId: client.id,
    });
    const order = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Item permissions.',
    });
    const payload = {
      type: WORK_ORDER_ITEM_TYPE.LABOR,
      description: 'Diagnosis',
      count: '1.00',
      unitValue: '50000.00',
    };

    const mechanicItem = await request(app)
      .post(`/api/work-orders/${order.id}/items`)
      .set(mechanicHeaders())
      .send(payload);
    const adminItem = await request(app)
      .post(`/api/work-orders/${order.id}/items`)
      .set(adminHeaders())
      .send({ ...payload, description: 'Admin diagnosis' });
    expect(mechanicItem.status).toBe(201);
    expect(adminItem.status).toBe(201);

    const forbidden = await request(app)
      .delete(`/api/work-orders/items/${mechanicItem.body.data.item.id}`)
      .set(mechanicHeaders());
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect(await models.WorkOrderItem.findByPk(mechanicItem.body.data.item.id)).not.toBeNull();

    await request(app)
      .delete(`/api/work-orders/items/${mechanicItem.body.data.item.id}`)
      .set(adminHeaders())
      .expect(200);
  });

  it('registers ADMIN and MECANICO users only through ADMIN', async () => {
    const mechanicResponse = await request(app)
      .post('/api/auth/register')
      .set(adminHeaders())
      .send({
        ...registerPayload(),
        id: 999999,
        passwordHash: 'attacker-value',
        active: false,
      });
    expect(mechanicResponse.status).toBe(201);
    expect(mechanicResponse.body.data).toMatchObject({
      email: 'new.mechanic@example.test',
      role: USER_ROLE.MECHANIC,
      active: true,
    });
    expect(mechanicResponse.body.data.id).not.toBe(999999);
    expect(JSON.stringify(mechanicResponse.body)).not.toMatch(/password|refresh/i);

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .set(adminHeaders())
      .send(registerPayload({
        name: 'Second Admin',
        email: 'second.admin@example.test',
        role: USER_ROLE.ADMIN,
      }));
    expect(adminResponse.status).toBe(201);
    expect(adminResponse.body.data.role).toBe(USER_ROLE.ADMIN);

    await request(app)
      .post('/api/auth/register')
      .set(mechanicHeaders())
      .send(registerPayload({ email: 'forbidden@example.test' }))
      .expect(403);
    await request(app)
      .post('/api/auth/register')
      .send(registerPayload({ email: 'unauthenticated@example.test' }))
      .expect(401);
  });

  it('rejects duplicate and normalized duplicate emails with 409', async () => {
    const first = await request(app)
      .post('/api/auth/register')
      .set(adminHeaders())
      .send(registerPayload());
    expect(first.status).toBe(201);

    for (const email of ['new.mechanic@example.test', '  NEW.MECHANIC@EXAMPLE.TEST  ']) {
      const duplicate = await request(app)
        .post('/api/auth/register')
        .set(adminHeaders())
        .send(registerPayload({ email }));
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error).toEqual({
        code: 'USER_EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists.',
      });
    }
  });

  it('validates registration fields and a minimal eight-character password', async () => {
    const invalid = await request(app)
      .post('/api/auth/register')
      .set(adminHeaders())
      .send({ name: '', email: 'invalid', password: 'short', role: 'USER' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.map(({ field }) => field)).toEqual(
      expect.arrayContaining(['name', 'email', 'password', 'role']),
    );
  });

  it('lists only safe users for ADMIN and returns 401/403 at the boundary', async () => {
    const response = await request(app).get('/api/users').set(adminHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    for (const user of response.body.data) {
      expect(user).toEqual({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.stringMatching(/^(ADMIN|MECANICO)$/),
        active: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    }
    expect(JSON.stringify(response.body)).not.toMatch(/password|refresh|tokenHash/i);

    await request(app).get('/api/users').set(mechanicHeaders()).expect(403);
    await request(app).get('/api/users').expect(401);
  });

  it('changes roles for ADMIN and preserves validation/not-found/role semantics', async () => {
    const forbiddenBeforeIdValidation = await request(app)
      .patch('/api/users/not-an-id/role')
      .set(mechanicHeaders())
      .send({ role: USER_ROLE.ADMIN });
    expect(forbiddenBeforeIdValidation.status).toBe(403);

    const changed = await request(app)
      .patch(`/api/users/${mechanic.id}/role`)
      .set(adminHeaders())
      .send({ role: USER_ROLE.ADMIN });
    expect(changed.status).toBe(200);
    expect(changed.body.data.role).toBe(USER_ROLE.ADMIN);

    const invalid = await request(app)
      .patch(`/api/users/${mechanic.id}/role`)
      .set(adminHeaders())
      .send({ role: 'USER' });
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .patch('/api/users/999999/role')
      .set(adminHeaders())
      .send({ role: USER_ROLE.ADMIN });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('USER_NOT_FOUND');

  });

  it('deactivates and reactivates users with strict boolean validation', async () => {
    const deactivated = await request(app)
      .patch(`/api/users/${mechanic.id}/active`)
      .set(adminHeaders())
      .send({ active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.active).toBe(false);

    const reactivated = await request(app)
      .patch(`/api/users/${mechanic.id}/active`)
      .set(adminHeaders())
      .send({ active: true });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.active).toBe(true);

    await request(app)
      .patch(`/api/users/${mechanic.id}/active`)
      .set(adminHeaders())
      .send({ active: 'false' })
      .expect(400);
    await request(app)
      .patch('/api/users/999999/active')
      .set(adminHeaders())
      .send({ active: false })
      .expect(404);
    await request(app)
      .patch(`/api/users/${admin.id}/active`)
      .set(mechanicHeaders())
      .send({ active: false })
      .expect(403);
  });

  it('immediately rejects an existing token after deactivation', async () => {
    await request(app)
      .get('/api/clients')
      .set(mechanicHeaders())
      .expect(200);
    await request(app)
      .patch(`/api/users/${mechanic.id}/active`)
      .set(adminHeaders())
      .send({ active: false })
      .expect(200);

    const rejected = await request(app)
      .get('/api/clients')
      .set(mechanicHeaders());
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('immediately rejects an existing token after a role change', async () => {
    await request(app)
      .patch(`/api/users/${mechanic.id}/role`)
      .set(adminHeaders())
      .send({ role: USER_ROLE.ADMIN })
      .expect(200);

    const rejected = await request(app)
      .get('/api/clients')
      .set(mechanicHeaders());
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('allows MECANICO intermediate transitions but forbids valid deliver/cancel targets', async () => {
    const client = await models.Client.create({ name: 'Status Client', phone: '3009999999' });
    const bike = await models.Bike.create({
      plate: 'RBS001',
      brand: 'Suzuki',
      model: 'GN',
      clientId: client.id,
    });
    const order = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Mechanic workflow.',
    });

    for (const toStatus of [
      WORK_ORDER_STATUS.DIAGNOSIS,
      WORK_ORDER_STATUS.IN_PROGRESS,
      WORK_ORDER_STATUS.READY,
    ]) {
      const response = await request(app)
        .patch(`/api/work-orders/${order.id}/status`)
        .set(mechanicHeaders())
        .send({ toStatus });
      expect(response.status).toBe(200);
    }

    const deliver = await request(app)
      .patch(`/api/work-orders/${order.id}/status`)
      .set(mechanicHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.DELIVERED });
    expect(deliver.status).toBe(403);
    expect(deliver.body.error.code).toBe('FORBIDDEN');

    const cancellable = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Mechanic cancellation boundary.',
    });
    const cancel = await request(app)
      .patch(`/api/work-orders/${cancellable.id}/status`)
      .set(mechanicHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.CANCELLED });
    expect(cancel.status).toBe(403);
  });

  it('keeps workflow validity separate from role permission and allows ADMIN terminal targets', async () => {
    const client = await models.Client.create({ name: 'Admin Status', phone: '3008888888' });
    const bike = await models.Bike.create({
      plate: 'RBA001',
      brand: 'Honda',
      model: 'XR',
      clientId: client.id,
    });
    const invalidOrder = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Invalid workflow.',
    });
    const invalid = await request(app)
      .patch(`/api/work-orders/${invalidOrder.id}/status`)
      .set(adminHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.READY });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const deliveredOrder = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Admin delivery.',
      status: WORK_ORDER_STATUS.READY,
    });
    await request(app)
      .patch(`/api/work-orders/${deliveredOrder.id}/status`)
      .set(adminHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.DELIVERED })
      .expect(200);

    const cancelledOrder = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Admin cancellation.',
    });
    await request(app)
      .patch(`/api/work-orders/${cancelledOrder.id}/status`)
      .set(adminHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.CANCELLED })
      .expect(200);

    const mechanicInvalid = await request(app)
      .patch(`/api/work-orders/${invalidOrder.id}/status`)
      .set(mechanicHeaders())
      .send({ toStatus: WORK_ORDER_STATUS.DELIVERED });
    expect(mechanicInvalid.status).toBe(400);
    expect(mechanicInvalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});
