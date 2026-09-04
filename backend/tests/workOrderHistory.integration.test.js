import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';

import { app } from '../src/app.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { env } from '../src/config/env.js';
import { USER_ROLE } from '../src/constants/auth.js';
import { WORK_ORDER_STATUS } from '../src/constants/workOrder.js';
import { workOrderStatusHistoryRepository } from '../src/repositories/workOrderStatusHistoryRepository.js';
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
};

const createBike = async (plate = 'AUD001') => {
  const client = await models.Client.create({
    name: 'Audit Client',
    phone: '3001234567',
    email: 'audit.client@example.test',
  });
  const bike = await models.Bike.create({
    plate,
    brand: 'Yamaha',
    model: 'FZ',
    clientId: client.id,
  });
  return { client, bike };
};

const createPersistedOrder = (bikeId, overrides = {}) =>
  models.WorkOrder.create({
    bikeId,
    entryDate: new Date('2026-08-24T15:00:00.000Z'),
    faultDescription: 'Audit verification.',
    assignedMechanicId: mechanic.id,
    ...overrides,
  });

const transition = (request, workOrderId, toStatus, note) => {
  const payload = { toStatus };
  if (note !== undefined) payload.note = note;
  return request(app)
    .patch(`/api/work-orders/${workOrderId}/status`)
    .send(payload);
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
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 9 work-order status audit history', () => {
  it('creates exactly one NULL -> RECIBIDA event with the authenticated creator', async () => {
    const { bike } = await createBike();
    const beforeRequest = Date.now();
    const response = await adminRequest(app).post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Engine vibration.',
      changedByUserId: mechanic.id,
      fromStatus: WORK_ORDER_STATUS.DELIVERED,
      toStatus: WORK_ORDER_STATUS.CANCELLED,
      note: 'Untrusted initial note.',
    });
    const afterRequest = Date.now();

    expect(response.status).toBe(201);
    const rows = await models.WorkOrderStatusHistory.findAll({
      where: { workOrderId: response.body.data.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      note: null,
      changedByUserId: admin.id,
    });
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(beforeRequest - 1000);
    expect(rows[0].createdAt.getTime()).toBeLessThanOrEqual(afterRequest + 1000);
  });

  it('rolls back work-order creation when the initial history insert fails', async () => {
    const { bike } = await createBike();
    vi.spyOn(workOrderStatusHistoryRepository, 'create').mockRejectedValueOnce(
      new Error('simulated initial audit persistence failure'),
    );

    const response = await adminRequest(app).post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Creation rollback verification.',
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(await models.WorkOrder.count()).toBe(0);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
  });

  it('records actor, from/to, trimmed note and cancellation once per valid change', async () => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id);

    await transition(
      mechanicRequest,
      workOrder.id,
      WORK_ORDER_STATUS.DIAGNOSIS,
      '  Diagnosis complete.  ',
    ).expect(200);
    await transition(
      adminRequest,
      workOrder.id,
      WORK_ORDER_STATUS.CANCELLED,
      'Customer declined repair.',
    ).expect(200);

    const rows = await models.WorkOrderStatusHistory.findAll({
      where: { workOrderId: workOrder.id },
      order: [['id', 'ASC']],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fromStatus: WORK_ORDER_STATUS.RECEIVED,
      toStatus: WORK_ORDER_STATUS.DIAGNOSIS,
      note: 'Diagnosis complete.',
      changedByUserId: mechanic.id,
    });
    expect(rows[1]).toMatchObject({
      fromStatus: WORK_ORDER_STATUS.DIAGNOSIS,
      toStatus: WORK_ORDER_STATUS.CANCELLED,
      note: 'Customer declined repair.',
      changedByUserId: admin.id,
    });
    expect(rows.every(({ createdAt }) => createdAt instanceof Date)).toBe(true);
  });

  it.each([
    ['invalid', WORK_ORDER_STATUS.RECEIVED, WORK_ORDER_STATUS.READY, adminRequest, 400],
    ['same-state', WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.IN_PROGRESS, adminRequest, 400],
    ['terminal', WORK_ORDER_STATUS.DELIVERED, WORK_ORDER_STATUS.CANCELLED, adminRequest, 400],
    ['forbidden', WORK_ORDER_STATUS.READY, WORK_ORDER_STATUS.DELIVERED, mechanicRequest, 403],
  ])('creates no event for a %s transition attempt', async (
    _case,
    fromStatus,
    toStatus,
    authenticatedRequest,
    expectedStatus,
  ) => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id, { status: fromStatus });

    const response = await transition(authenticatedRequest, workOrder.id, toStatus);

    expect(response.status).toBe(expectedStatus);
    expect(await models.WorkOrderStatusHistory.count({
      where: { workOrderId: workOrder.id },
    })).toBe(0);
    await workOrder.reload();
    expect(workOrder.status).toBe(fromStatus);
  });

  it('rolls back the status update when history persistence fails', async () => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id);
    vi.spyOn(workOrderStatusHistoryRepository, 'create').mockRejectedValueOnce(
      new Error('simulated transition audit persistence failure'),
    );

    const response = await transition(
      adminRequest,
      workOrder.id,
      WORK_ORDER_STATUS.DIAGNOSIS,
    );

    expect(response.status).toBe(500);
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.RECEIVED);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
  });

  it('allows both roles to read safe newest-first history and returns 404 for a missing parent', async () => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id);
    await transition(mechanicRequest, workOrder.id, WORK_ORDER_STATUS.DIAGNOSIS).expect(200);
    await transition(adminRequest, workOrder.id, WORK_ORDER_STATUS.CANCELLED).expect(200);

    for (const authenticatedRequest of [adminRequest, mechanicRequest]) {
      const response = await authenticatedRequest(app)
        .get(`/api/work-orders/${workOrder.id}/history`);
      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      });
      expect(response.body.data.map(({ toStatus }) => toStatus)).toEqual([
        WORK_ORDER_STATUS.CANCELLED,
        WORK_ORDER_STATUS.DIAGNOSIS,
      ]);
      expect(response.body.data[0].changedBy).toEqual({
        id: admin.id,
        name: 'Audit Admin',
      });
      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'changedBy',
        'createdAt',
        'fromStatus',
        'id',
        'note',
        'toStatus',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/email|password|active|role/i);
    }

    await adminRequest(app).get('/api/work-orders/999999/history').expect(404);
  });

  it('requires authentication and validates id, page and the pageSize maximum', async () => {
    await request(app)
      .get('/api/work-orders/1/history')
      .expect(401);

    for (const path of [
      '/api/work-orders/not-an-id/history',
      '/api/work-orders/1/history?page=0',
      '/api/work-orders/1/history?pageSize=0',
      '/api/work-orders/1/history?pageSize=101',
    ]) {
      const response = await adminRequest(app).get(path);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('paginates 150 tied events as 100/50 with deterministic id-desc ordering', async () => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id);
    const tiedCreatedAt = new Date('2026-08-24T17:00:00.000Z');
    const createdRows = await models.WorkOrderStatusHistory.bulkCreate(
      Array.from({ length: 150 }, (_, index) => ({
        workOrderId: workOrder.id,
        fromStatus: index === 0 ? null : WORK_ORDER_STATUS.RECEIVED,
        toStatus: WORK_ORDER_STATUS.RECEIVED,
        note: `Historical event ${index + 1}`,
        changedByUserId: admin.id,
        createdAt: tiedCreatedAt,
      })),
    );
    const expectedIds = createdRows.map(({ id }) => id).sort((left, right) => right - left);

    const defaultResponse = await adminRequest(app)
      .get(`/api/work-orders/${workOrder.id}/history`);
    const startedAt = performance.now();
    const firstPage = await adminRequest(app)
      .get(`/api/work-orders/${workOrder.id}/history?page=1&pageSize=100`);
    const firstPageElapsedMs = performance.now() - startedAt;
    const secondPage = await mechanicRequest(app)
      .get(`/api/work-orders/${workOrder.id}/history?page=2&pageSize=100`);

    console.info(
      `[history-performance] 150 rows, pageSize 100: ${firstPageElapsedMs.toFixed(2)} ms`,
    );
    expect(firstPageElapsedMs).toBeLessThan(1000);

    expect(defaultResponse.body.meta).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 150,
      totalPages: 8,
    });
    expect(defaultResponse.body.data).toHaveLength(20);
    expect(firstPage.body.meta).toEqual({
      page: 1,
      pageSize: 100,
      totalItems: 150,
      totalPages: 2,
    });
    expect(firstPage.body.data.map(({ id }) => id)).toEqual(expectedIds.slice(0, 100));
    expect(secondPage.body.meta).toEqual({
      page: 2,
      pageSize: 100,
      totalItems: 150,
      totalPages: 2,
    });
    expect(secondPage.body.data.map(({ id }) => id)).toEqual(expectedIds.slice(100));
  });

  it('serializes competing same-target requests to one change and one audit row', async () => {
    const { bike } = await createBike();
    const workOrder = await createPersistedOrder(bike.id);

    const responses = await Promise.all([
      transition(adminRequest, workOrder.id, WORK_ORDER_STATUS.DIAGNOSIS, 'First'),
      transition(adminRequest, workOrder.id, WORK_ORDER_STATUS.DIAGNOSIS, 'Second'),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 400]);
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    const rows = await models.WorkOrderStatusHistory.findAll({
      where: { workOrderId: workOrder.id },
    });
    expect(rows).toHaveLength(1);
    expect(['First', 'Second']).toContain(rows[0].note);
    expect(rows[0].changedByUserId).toBe(admin.id);
  });
});
