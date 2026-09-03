import { Op } from 'sequelize';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { app } from '../src/app.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  AUDIT_TRANSITION_KIND,
} from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let mechanic;
let adminAccessToken;
let mechanicAccessToken;
const adminRequest = createAuthenticatedRequest(() => adminAccessToken);
const mechanicRequest = createAuthenticatedRequest(() => mechanicAccessToken);

const cleanBusinessData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
  await models.RefreshToken.destroy({ where: {}, force: true });
  await models.User.destroy({
    where: { id: { [Op.notIn]: [admin.id, mechanic.id] } },
    force: true,
  });
};

const createClientThroughApi = async (authenticatedRequest = adminRequest) => {
  const response = await authenticatedRequest(app).post('/api/clients').send({
    name: 'Audit Client',
    phone: '3001234567',
    email: 'audit.client@example.test',
  });
  expect(response.status).toBe(201);
  return response.body.data;
};

const createBikeThroughApi = async (clientId) => {
  const response = await adminRequest(app).post('/api/bikes').send({
    plate: 'aud 001',
    brand: 'Yamaha',
    model: 'FZ',
    cylinder: '149',
    clientId,
  });
  expect(response.status).toBe(201);
  return response.body.data;
};

const createOrderThroughApi = async (bikeId) => {
  const response = await adminRequest(app).post('/api/work-orders').send({
    bikeId,
    entryDate: '2026-09-03T12:00:00.000Z',
    faultDescription: 'Abnormal engine noise.',
  });
  expect(response.status).toBe(201);
  return response.body.data;
};

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
  ({ user: admin, accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Audit Admin',
    email: 'audit.admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: mechanic, accessToken: mechanicAccessToken } = await createTestIdentity({
    name: 'Audit Mechanic',
    email: 'audit.mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  }));
});

beforeEach(async () => {
  await cleanBusinessData();
});

afterEach(() => {
  models.AuditEvent.removeHook('beforeCreate', 'force-audit-failure');
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('Global business audit', () => {
  it('records client creation with the authenticated actor and an explicit snapshot', async () => {
    const response = await adminRequest(app).post('/api/clients').send({
      name: '  Traceable Client  ',
      phone: '  3009998877  ',
      email: '  TRACEABLE@EXAMPLE.TEST  ',
      actorUserId: mechanic.id,
      passwordHash: 'must-be-ignored',
    });

    expect(response.status).toBe(201);
    const event = await models.AuditEvent.findOne();
    expect(event).toMatchObject({
      entityType: AUDIT_ENTITY_TYPE.CLIENT,
      entityId: response.body.data.id,
      action: AUDIT_ACTION.CREATED,
      actorUserId: admin.id,
      beforeData: null,
      metadata: null,
      reason: null,
    });
    expect(event.afterData).toEqual({
      id: String(response.body.data.id),
      name: 'Traceable Client',
      phone: '3009998877',
      email: 'traceable@example.test',
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    });
    expect(JSON.stringify(event.afterData)).not.toMatch(/password|actorUserId/i);
  });

  it('records bike, work-order and item creation in their domain transactions', async () => {
    const client = await createClientThroughApi();
    const bike = await createBikeThroughApi(client.id);
    const order = await createOrderThroughApi(bike.id);
    const itemResponse = await adminRequest(app)
      .post(`/api/work-orders/${order.id}/items`)
      .send({
        type: WORK_ORDER_ITEM_TYPE.LABOR,
        description: 'Electronic diagnosis',
        count: '1.00',
        unitValue: '65000.00',
      });

    expect(itemResponse.status).toBe(201);
    const events = await models.AuditEvent.findAll({ order: [['id', 'ASC']] });
    expect(events.map(({ entityType, action }) => ({ entityType, action }))).toEqual([
      { entityType: AUDIT_ENTITY_TYPE.CLIENT, action: AUDIT_ACTION.CREATED },
      { entityType: AUDIT_ENTITY_TYPE.BIKE, action: AUDIT_ACTION.CREATED },
      { entityType: AUDIT_ENTITY_TYPE.WORK_ORDER, action: AUDIT_ACTION.CREATED },
      { entityType: AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM, action: AUDIT_ACTION.ITEM_ADDED },
    ]);
    expect(events[1].afterData).toMatchObject({
      id: String(bike.id),
      plate: 'AUD001',
      clientId: String(client.id),
    });
    expect(events[2].afterData).toMatchObject({
      id: String(order.id),
      bikeId: String(bike.id),
      status: WORK_ORDER_STATUS.RECEIVED,
      total: '0.00',
      assignedMechanicId: null,
    });
    expect(events[3].afterData).toMatchObject({
      id: String(itemResponse.body.data.item.id),
      workOrderId: String(order.id),
      unitValue: '65000.00',
      createdByUserId: null,
    });
  });

  it('records forward transitions and cancellation as one most-specific event each', async () => {
    const client = await models.Client.create({
      name: 'Status Client',
      phone: '3001112233',
    });
    const bike = await models.Bike.create({
      plate: 'STA001',
      brand: 'Honda',
      model: 'CB',
      clientId: client.id,
    });
    const order = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date('2026-09-03T12:00:00.000Z'),
      faultDescription: 'Status audit.',
      status: WORK_ORDER_STATUS.RECEIVED,
      total: '0.00',
    });

    await adminRequest(app)
      .patch(`/api/work-orders/${order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS, note: 'Initial diagnosis.' })
      .expect(200);
    await adminRequest(app)
      .patch(`/api/work-orders/${order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.CANCELLED, note: 'Client withdrew.' })
      .expect(200);

    const events = await models.AuditEvent.findAll({ order: [['id', 'ASC']] });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: AUDIT_ACTION.STATUS_CHANGED,
      reason: 'Initial diagnosis.',
      metadata: { transitionKind: AUDIT_TRANSITION_KIND.FORWARD },
    });
    expect(events[0].beforeData.status).toBe(WORK_ORDER_STATUS.RECEIVED);
    expect(events[0].afterData.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(events[1]).toMatchObject({
      action: AUDIT_ACTION.CANCELLED,
      reason: 'Client withdrew.',
      metadata: null,
    });
    expect(events[1].beforeData.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(events[1].afterData.status).toBe(WORK_ORDER_STATUS.CANCELLED);
  });

  it('audits ADMIN-created users without persisting password material', async () => {
    const password = 'Highly-sensitive-password-123';
    const response = await adminRequest(app).post('/api/auth/register').send({
      name: 'Audited Mechanic',
      email: 'audited.mechanic@example.test',
      password,
      role: USER_ROLE.MECHANIC,
    });

    expect(response.status).toBe(201);
    const event = await models.AuditEvent.findOne();
    expect(event).toMatchObject({
      entityType: AUDIT_ENTITY_TYPE.USER,
      action: AUDIT_ACTION.CREATED,
      actorUserId: admin.id,
    });
    expect(event.afterData).toEqual({
      id: String(response.body.data.id),
      name: 'Audited Mechanic',
      email: 'audited.mechanic@example.test',
      role: USER_ROLE.MECHANIC,
      active: true,
    });
    expect(JSON.stringify(event.get({ plain: true }))).not.toContain(password);
    expect(JSON.stringify(event.afterData)).not.toMatch(/password|hash|token|secret/i);
  });

  it('rolls back all work-order writes when its audit event cannot be persisted', async () => {
    const client = await models.Client.create({
      name: 'Atomic Client',
      phone: '3007654321',
    });
    const bike = await models.Bike.create({
      plate: 'ATM001',
      brand: 'Suzuki',
      model: 'GN',
      clientId: client.id,
    });
    models.AuditEvent.addHook('beforeCreate', 'force-audit-failure', () => {
      throw new Error('Forced audit failure');
    });

    const response = await adminRequest(app).post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Must roll back.',
    });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(await models.WorkOrder.count()).toBe(0);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('rolls back client, bike and user creation when their audit writes fail', async () => {
    models.AuditEvent.addHook('beforeCreate', 'force-audit-failure', () => {
      throw new Error('Forced audit failure');
    });

    await adminRequest(app).post('/api/clients').send({
      name: 'Rolled-back Client',
      phone: '3002223344',
    }).expect(500);
    expect(await models.Client.count()).toBe(0);

    const owner = await models.Client.create({
      name: 'Existing Owner',
      phone: '3003334455',
    });
    await adminRequest(app).post('/api/bikes').send({
      plate: 'RBK001',
      brand: 'Honda',
      model: 'XR',
      clientId: owner.id,
    }).expect(500);
    expect(await models.Bike.count()).toBe(0);

    await adminRequest(app).post('/api/auth/register').send({
      name: 'Rolled-back User',
      email: 'rolled.back@example.test',
      password: 'Rolled-back-password-123',
      role: USER_ROLE.MECHANIC,
    }).expect(500);
    expect(await models.User.count({
      where: { email: 'rolled.back@example.test' },
    })).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('rolls back item totals and status history when audit writes fail', async () => {
    const client = await models.Client.create({
      name: 'Mutation Atomic Client',
      phone: '3004445566',
    });
    const bike = await models.Bike.create({
      plate: 'MAT001',
      brand: 'Yamaha',
      model: 'XTZ',
      clientId: client.id,
    });
    const order = await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date(),
      faultDescription: 'Mutation atomicity.',
      status: WORK_ORDER_STATUS.RECEIVED,
      total: '0.00',
    });
    models.AuditEvent.addHook('beforeCreate', 'force-audit-failure', () => {
      throw new Error('Forced audit failure');
    });

    await adminRequest(app).post(`/api/work-orders/${order.id}/items`).send({
      type: WORK_ORDER_ITEM_TYPE.LABOR,
      description: 'Must roll back',
      count: '1.00',
      unitValue: '50000.00',
    }).expect(500);
    await adminRequest(app).patch(`/api/work-orders/${order.id}/status`).send({
      toStatus: WORK_ORDER_STATUS.DIAGNOSIS,
      note: 'Must also roll back.',
    }).expect(500);

    await order.reload();
    expect(order.total).toBe('0.00');
    expect(order.status).toBe(WORK_ORDER_STATUS.RECEIVED);
    expect(await models.WorkOrderItem.count()).toBe(0);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('lists and filters events with bounded pagination and safe actor data', async () => {
    const first = await createClientThroughApi(adminRequest);
    const secondResponse = await adminRequest(app).post('/api/clients').send({
      name: 'Second Audit Client',
      phone: '3011112233',
      email: null,
    });
    expect(secondResponse.status).toBe(201);
    const dateFrom = new Date(Date.now() - 60_000).toISOString();
    const dateTo = new Date(Date.now() + 60_000).toISOString();

    const response = await adminRequest(app).get('/api/audit-events').query({
      entityType: AUDIT_ENTITY_TYPE.CLIENT,
      entityId: first.id,
      action: AUDIT_ACTION.CREATED,
      actorUserId: admin.id,
      dateFrom,
      dateTo,
      page: 1,
      pageSize: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      entityType: AUDIT_ENTITY_TYPE.CLIENT,
      entityId: first.id,
      action: AUDIT_ACTION.CREATED,
      actor: { id: admin.id, name: admin.name },
    });
    expect(response.body.data[0].actor).not.toHaveProperty('email');
    expect(response.body.data[0]).not.toHaveProperty('actorUserId');

    const detail = await adminRequest(app)
      .get(`/api/audit-events/${response.body.data[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toEqual(response.body.data[0]);
  });

  it('validates audit filters and missing event ids', async () => {
    const invalid = await adminRequest(app).get('/api/audit-events').query({
      entityType: 'SECRET',
      action: 'ERASED',
      actorUserId: '0',
      dateFrom: '2026-02-30T00:00:00.000Z',
      dateTo: '2026-01-01T00:00:00.000Z',
      pageSize: 101,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.map(({ field }) => field)).toEqual(
      expect.arrayContaining([
        'entityType',
        'action',
        'actorUserId',
        'dateFrom',
        'pageSize',
      ]),
    );

    const missing = await adminRequest(app).get('/api/audit-events/999999');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('AUDIT_EVENT_NOT_FOUND');
  });

  it('restricts reads to ADMIN before validation and exposes no mutation API', async () => {
    const unauthenticated = await request(app).get('/api/audit-events?page=0');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const forbidden = await mechanicRequest(app).get('/api/audit-events?page=0');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    await adminRequest(app).post('/api/audit-events').send({}).expect(404);
    await adminRequest(app).patch('/api/audit-events/1').send({}).expect(404);
    await adminRequest(app).delete('/api/audit-events/1').expect(404);
  });

  it('does not create audit rows for rejected domain operations', async () => {
    const invalid = await adminRequest(app).post('/api/clients').send({});
    expect(invalid.status).toBe(400);
    expect(await models.AuditEvent.count()).toBe(0);
  });
});
