import supertest from 'supertest';
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

import { app } from '../src/app.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  OPEN_WORK_ORDER_STATUSES,
  WORK_ORDER_REOPEN_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import { auditService } from '../src/services/auditService.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let mechanic;
let adminRequest;
let mechanicRequest;
let plateSequence = 0;

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createDeliveredOrder = async ({
  status = WORK_ORDER_STATUS.DELIVERED,
  assignedMechanicId,
} = {}) => {
  plateSequence += 1;
  const suffix = String(plateSequence).padStart(3, '0');
  const client = await models.Client.create({
    name: `Warranty Client ${suffix}`,
    phone: `3100000${suffix}`,
    email: `warranty-${suffix}@example.test`,
  });
  const bike = await models.Bike.create({
    plate: `WAR${suffix}`,
    brand: 'Yamaha',
    model: 'FZ 2.0',
    cylinder: '149',
    clientId: client.id,
  });
  const workOrder = await models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-09-03T15:00:00.000Z'),
    faultDescription: 'Intermittent engine failure.',
    status,
    total: '125000.50',
    assignedMechanicId: assignedMechanicId ?? mechanic.id,
  });
  return { client, bike, workOrder };
};

const reopen = (id, overrides = {}) =>
  adminRequest.post(`/api/work-orders/${id}/reopen`).send({
    type: WORK_ORDER_REOPEN_TYPE.WARRANTY,
    reason: 'The same failure persists under warranty.',
    ...overrides,
  });

const reopeningEvents = (workOrderId) =>
  models.AuditEvent.findAll({
    where: {
      entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
      entityId: workOrderId,
      action: AUDIT_ACTION.REOPENED,
    },
    order: [['id', 'ASC']],
  });

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

  const adminIdentity = await createTestIdentity({
    name: 'Warranty Admin',
    email: 'warranty.admin@example.test',
    role: USER_ROLE.ADMIN,
  });
  admin = adminIdentity.user;
  adminRequest = createAuthenticatedRequest(() => adminIdentity.accessToken)(app);

  const mechanicIdentity = await createTestIdentity({
    name: 'Warranty Mechanic',
    email: 'warranty.mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  });
  mechanic = mechanicIdentity.user;
  mechanicRequest = createAuthenticatedRequest(
    () => mechanicIdentity.accessToken,
  )(app);
});

beforeEach(cleanDomainData);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 11 work-order reopening', () => {
  it.each([
    WORK_ORDER_REOPEN_TYPE.WARRANTY,
    WORK_ORDER_REOPEN_TYPE.SAME_ISSUE,
  ])('reopens a delivered order as %s with one history and audit event', async (type) => {
    const { bike, workOrder } = await createDeliveredOrder();

    const response = await reopen(workOrder.id, {
      type,
      reason: '  Persiste la falla reportada por el cliente.  ',
      actorUserId: mechanic.id,
      status: WORK_ORDER_STATUS.CANCELLED,
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: workOrder.id,
      bikeId: bike.id,
      status: WORK_ORDER_STATUS.DIAGNOSIS,
      total: '125000.50',
      assignedMechanicId: mechanic.id,
    });
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(workOrder.total).toBe('125000.50');
    expect(workOrder.assignedMechanicId).toBe(mechanic.id);

    const histories = await models.WorkOrderStatusHistory.findAll({
      where: { workOrderId: workOrder.id },
    });
    expect(histories).toHaveLength(1);
    expect(histories[0]).toMatchObject({
      fromStatus: WORK_ORDER_STATUS.DELIVERED,
      toStatus: WORK_ORDER_STATUS.DIAGNOSIS,
      note: 'Persiste la falla reportada por el cliente.',
      changedByUserId: admin.id,
    });

    const events = await reopeningEvents(workOrder.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: AUDIT_ACTION.REOPENED,
      actorUserId: admin.id,
      reason: 'Persiste la falla reportada por el cliente.',
      metadata: { reopenType: type },
    });
    expect(events[0].beforeData.status).toBe(WORK_ORDER_STATUS.DELIVERED);
    expect(events[0].afterData.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(events[0].beforeData.total).toBe('125000.50');
    expect(events[0].afterData.total).toBe('125000.50');
  });

  it('authorizes ADMIN before validating the dedicated operation', async () => {
    const { workOrder } = await createDeliveredOrder();
    const invalidPayload = { type: 'OTHER', reason: '' };

    const unauthenticated = await supertest(app)
      .post(`/api/work-orders/${workOrder.id}/reopen`)
      .send(invalidPayload);
    const forbidden = await mechanicRequest
      .post(`/api/work-orders/${workOrder.id}/reopen`)
      .send(invalidPayload);

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DELIVERED);
  });

  it.each([
    ['missing type', { reason: 'Valid reason.' }, 'type'],
    ['unsupported type', { type: 'OTHER', reason: 'Valid reason.' }, 'type'],
    ['missing reason', { type: WORK_ORDER_REOPEN_TYPE.WARRANTY }, 'reason'],
    [
      'blank reason',
      { type: WORK_ORDER_REOPEN_TYPE.SAME_ISSUE, reason: '   ' },
      'reason',
    ],
    [
      'oversized reason',
      { type: WORK_ORDER_REOPEN_TYPE.WARRANTY, reason: 'r'.repeat(1001) },
      'reason',
    ],
  ])('rejects %s without side effects', async (_label, payload, field) => {
    const { workOrder } = await createDeliveredOrder();

    const response = await adminRequest
      .post(`/api/work-orders/${workOrder.id}/reopen`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field }),
    );
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DELIVERED);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('rejects a malformed id and a missing order', async () => {
    const malformed = await reopen('not-an-id');
    const missing = await reopen(999999);

    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
    expect(malformed.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'id' }),
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('WORK_ORDER_NOT_FOUND');
  });

  it.each([
    WORK_ORDER_STATUS.RECEIVED,
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.READY,
    WORK_ORDER_STATUS.CANCELLED,
  ])('rejects reopening from %s', async (status) => {
    const { workOrder } = await createDeliveredOrder({ status });

    const response = await reopen(workOrder.id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('WORK_ORDER_NOT_DELIVERED');
    expect((await workOrder.reload()).status).toBe(status);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('keeps delivered-to-diagnosis forbidden through the generic status route', async () => {
    const { workOrder } = await createDeliveredOrder();

    const response = await adminRequest
      .patch(`/api/work-orders/${workOrder.id}/status`)
      .send({
        toStatus: WORK_ORDER_STATUS.DIAGNOSIS,
        note: 'This must use the dedicated reopening operation.',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DELIVERED);
  });

  it('requires an active motorcycle and active current owner', async () => {
    const deletedBikeFixture = await createDeliveredOrder();
    await deletedBikeFixture.bike.update({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Deleted fixture.',
    });
    const deletedBikeResponse = await reopen(deletedBikeFixture.workOrder.id);
    expect(deletedBikeResponse.status).toBe(409);
    expect(deletedBikeResponse.body.error.code).toBe('BIKE_INACTIVE');

    await cleanDomainData();
    const deletedOwnerFixture = await createDeliveredOrder();
    await deletedOwnerFixture.client.update({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Deleted owner fixture.',
    });
    const deletedOwnerResponse = await reopen(deletedOwnerFixture.workOrder.id);
    expect(deletedOwnerResponse.status).toBe(409);
    expect(deletedOwnerResponse.body.error.code).toBe('BIKE_OWNER_INACTIVE');

    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('rejects reopening when another open order already exists for the bike', async () => {
    const { bike, workOrder } = await createDeliveredOrder();
    await models.WorkOrder.create({
      bikeId: bike.id,
      entryDate: new Date('2026-09-03T16:00:00.000Z'),
      faultDescription: 'A different active repair.',
      status: WORK_ORDER_STATUS.RECEIVED,
      total: '0.00',
    });

    const response = await reopen(workOrder.id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BIKE_HAS_ACTIVE_WORK_ORDER');
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DELIVERED);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await reopeningEvents(workOrder.id)).toHaveLength(0);
  });

  it('rolls back status and history when the audit write fails', async () => {
    const { workOrder } = await createDeliveredOrder();
    vi.spyOn(auditService, 'record').mockRejectedValueOnce(
      new Error('simulated reopen audit failure'),
    );

    const response = await reopen(workOrder.id);

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toContain('simulated');
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DELIVERED);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('allows only one of two concurrent reopening requests', async () => {
    const { workOrder } = await createDeliveredOrder();

    const responses = await Promise.all([
      reopen(workOrder.id, {
        type: WORK_ORDER_REOPEN_TYPE.WARRANTY,
        reason: 'Concurrent warranty return.',
      }),
      reopen(workOrder.id, {
        type: WORK_ORDER_REOPEN_TYPE.SAME_ISSUE,
        reason: 'Concurrent same-issue return.',
      }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(responses.find(({ status }) => status === 409).body.error.code)
      .toBe('WORK_ORDER_NOT_DELIVERED');
    expect((await workOrder.reload()).status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(await models.WorkOrderStatusHistory.count({
      where: { workOrderId: workOrder.id },
    })).toBe(1);
    expect(await reopeningEvents(workOrder.id)).toHaveLength(1);
  });

  it('serializes reopening against creation of an unrelated order', async () => {
    const { bike, workOrder } = await createDeliveredOrder();

    const [reopenResponse, createResponse] = await Promise.all([
      reopen(workOrder.id),
      adminRequest.post('/api/work-orders').send({
        bikeId: bike.id,
        faultDescription: 'A new and unrelated failure.',
      }),
    ]);

    expect([200, 409]).toContain(reopenResponse.status);
    expect([201, 409]).toContain(createResponse.status);
    expect([reopenResponse.status, createResponse.status].filter(
      (status) => status < 300,
    )).toHaveLength(1);
    expect(await models.WorkOrder.count({
      where: { bikeId: bike.id, status: OPEN_WORK_ORDER_STATUSES },
    })).toBe(1);
  });

  it('serializes reopening against motorcycle deletion', async () => {
    const { bike, workOrder } = await createDeliveredOrder();

    const [reopenResponse, deleteResponse] = await Promise.all([
      reopen(workOrder.id),
      adminRequest.delete(`/api/bikes/${bike.id}`).send({
        reason: 'Concurrent retirement.',
      }),
    ]);

    expect([200, 409]).toContain(reopenResponse.status);
    expect([200, 409]).toContain(deleteResponse.status);
    expect([reopenResponse.status, deleteResponse.status].filter(
      (status) => status < 300,
    )).toHaveLength(1);

    await bike.reload();
    const openOrderCount = await models.WorkOrder.count({
      where: { bikeId: bike.id, status: OPEN_WORK_ORDER_STATUSES },
    });
    expect(bike.deletedAt !== null && openOrderCount > 0).toBe(false);
  });
});
