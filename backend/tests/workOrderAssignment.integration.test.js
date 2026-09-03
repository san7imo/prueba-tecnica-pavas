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
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { env } from '../src/config/env.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import { WORK_ORDER_STATUS } from '../src/constants/workOrder.js';
import { auditService } from '../src/services/auditService.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let adminRequest;
let mechanicRequest;
let adminAccessToken;
let mechanicAccessToken;
let admin;
let secondAdmin;
let mechanicA;
let mechanicB;
let mechanicC;
let inactiveMechanic;

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createBike = async (plate = 'ASN001') => {
  const client = await models.Client.create({
    name: `Assignment Client ${plate}`,
    phone: `300${plate.replace(/\D/g, '').padEnd(7, '0')}`,
  });
  const bike = await models.Bike.create({
    plate,
    brand: 'Honda',
    model: 'CB 190R',
    clientId: client.id,
  });
  return { client, bike };
};

const createOrder = async ({
  plate = 'ASN001',
  status = WORK_ORDER_STATUS.RECEIVED,
  assignedMechanicId = null,
} = {}) => {
  const { bike } = await createBike(plate);
  return models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-09-03T15:00:00.000Z'),
    faultDescription: `Assignment test for ${plate}.`,
    status,
    total: '0.00',
    assignedMechanicId,
  });
};

const assignmentEvents = () =>
  models.AuditEvent.findAll({
    where: {
      entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
      action: [
        AUDIT_ACTION.ASSIGNED,
        AUDIT_ACTION.REASSIGNED,
        AUDIT_ACTION.UNASSIGNED,
      ],
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

  ({ user: admin, accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Assignment Admin',
    email: 'assignment.admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: secondAdmin } = await createTestIdentity({
    name: 'Assignment Non Mechanic',
    email: 'assignment.second-admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: mechanicA, accessToken: mechanicAccessToken } = await createTestIdentity({
    name: 'Mechanic A',
    email: 'assignment.mechanic-a@example.test',
    role: USER_ROLE.MECHANIC,
  }));
  ({ user: mechanicB } = await createTestIdentity({
    name: 'Mechanic B',
    email: 'assignment.mechanic-b@example.test',
    role: USER_ROLE.MECHANIC,
  }));
  ({ user: mechanicC } = await createTestIdentity({
    name: 'Mechanic C',
    email: 'assignment.mechanic-c@example.test',
    role: USER_ROLE.MECHANIC,
  }));
  ({ user: inactiveMechanic } = await createTestIdentity({
    name: 'Inactive Mechanic',
    email: 'assignment.inactive@example.test',
    role: USER_ROLE.MECHANIC,
    active: false,
  }));

  adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
  mechanicRequest = createAuthenticatedRequest(() => mechanicAccessToken)(app);
});

beforeEach(cleanDomainData);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 7 work-order mechanic assignment', () => {
  it('creates an order with one active mechanic and records it only in CREATED', async () => {
    const { bike } = await createBike();
    const response = await adminRequest.post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Assigned during reception.',
      assignedMechanicId: mechanicA.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      assignedMechanicId: mechanicA.id,
      assignedMechanic: {
        id: mechanicA.id,
        name: 'Mechanic A',
        role: USER_ROLE.MECHANIC,
        active: true,
      },
    });
    const events = await models.AuditEvent.findAll({ order: [['id', 'ASC']] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: AUDIT_ACTION.CREATED });
    expect(events[0].afterData.assignedMechanicId).toBe(String(mechanicA.id));
  });

  it.each([
    ['missing', '999999', 404, 'MECHANIC_NOT_FOUND'],
    ['ADMIN', () => secondAdmin.id, 409, 'ASSIGNEE_MUST_BE_MECHANIC'],
    ['inactive', () => inactiveMechanic.id, 409, 'MECHANIC_INACTIVE'],
  ])('rejects a %s assignee during creation without partial writes', async (
    _label,
    mechanicIdValue,
    expectedStatus,
    expectedCode,
  ) => {
    const { bike } = await createBike();
    const assignedMechanicId = typeof mechanicIdValue === 'function'
      ? mechanicIdValue()
      : mechanicIdValue;
    const response = await adminRequest.post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Invalid reception assignment.',
      assignedMechanicId,
    });

    expect(response.status).toBe(expectedStatus);
    expect(response.body.error.code).toBe(expectedCode);
    expect(await models.WorkOrder.count()).toBe(0);
    expect(await models.WorkOrderStatusHistory.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('assigns an unassigned open order without requiring a reason', async () => {
    const order = await createOrder();
    const response = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({
        mechanicId: mechanicA.id,
        actorUserId: mechanicA.id,
        assignedMechanicId: mechanicB.id,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: order.id,
      assignedMechanicId: mechanicA.id,
      assignedMechanic: { id: mechanicA.id, name: 'Mechanic A' },
    });
    const [event] = await assignmentEvents();
    expect(event).toMatchObject({
      action: AUDIT_ACTION.ASSIGNED,
      actorUserId: admin.id,
      reason: null,
      metadata: {
        previousMechanicId: null,
        newMechanicId: String(mechanicA.id),
      },
    });
    expect(event.beforeData.assignedMechanicId).toBeNull();
    expect(event.afterData.assignedMechanicId).toBe(String(mechanicA.id));
  });

  it('rejects invalid assignment targets without changing the open order', async () => {
    const order = await createOrder();
    const cases = [
      ['999999', 404, 'MECHANIC_NOT_FOUND'],
      [secondAdmin.id, 409, 'ASSIGNEE_MUST_BE_MECHANIC'],
      [inactiveMechanic.id, 409, 'MECHANIC_INACTIVE'],
    ];

    for (const [mechanicId, expectedStatus, expectedCode] of cases) {
      const response = await adminRequest
        .patch(`/api/work-orders/${order.id}/assignment`)
        .send({ mechanicId });
      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe(expectedCode);
    }

    expect((await order.reload()).assignedMechanicId).toBeNull();
    expect(await assignmentEvents()).toHaveLength(0);
  });

  it('requires and audits a normalized reason for reassignment', async () => {
    const order = await createOrder({ assignedMechanicId: mechanicA.id });
    const rejected = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: mechanicB.id });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('ASSIGNMENT_REASON_REQUIRED');
    expect((await order.reload()).assignedMechanicId).toBe(mechanicA.id);
    expect(await assignmentEvents()).toHaveLength(0);

    const response = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: mechanicB.id, reason: '  Redistribución de carga  ' });
    expect(response.status).toBe(200);
    expect(response.body.data.assignedMechanicId).toBe(mechanicB.id);

    const [event] = await assignmentEvents();
    expect(event).toMatchObject({
      action: AUDIT_ACTION.REASSIGNED,
      reason: 'Redistribución de carga',
      metadata: {
        previousMechanicId: String(mechanicA.id),
        newMechanicId: String(mechanicB.id),
      },
    });
  });

  it('requires a reason to intentionally return an order to unassigned', async () => {
    const order = await createOrder({ assignedMechanicId: mechanicA.id });
    const rejected = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: null, reason: '   ' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('ASSIGNMENT_REASON_REQUIRED');

    const response = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: null, reason: 'Regresa a la cola general.' });
    expect(response.status).toBe(200);
    expect(response.body.data.assignedMechanicId).toBeNull();
    expect(response.body.data.assignedMechanic).toBeNull();

    const [event] = await assignmentEvents();
    expect(event).toMatchObject({
      action: AUDIT_ACTION.UNASSIGNED,
      reason: 'Regresa a la cola general.',
      metadata: {
        previousMechanicId: String(mechanicA.id),
        newMechanicId: null,
      },
    });
  });

  it('rejects assignment changes for closed orders and unchanged assignments', async () => {
    const closed = await createOrder({
      plate: 'ASN002',
      status: WORK_ORDER_STATUS.DELIVERED,
    });
    const closedResponse = await adminRequest
      .patch(`/api/work-orders/${closed.id}/assignment`)
      .send({ mechanicId: mechanicA.id });
    expect(closedResponse.status).toBe(409);
    expect(closedResponse.body.error.code).toBe('WORK_ORDER_CLOSED');

    const assigned = await createOrder({
      plate: 'ASN003',
      assignedMechanicId: mechanicA.id,
    });
    const unchanged = await adminRequest
      .patch(`/api/work-orders/${assigned.id}/assignment`)
      .send({ mechanicId: mechanicA.id, reason: 'No actual change.' });
    expect(unchanged.status).toBe(400);
    expect(unchanged.body.error.code).toBe('ASSIGNMENT_UNCHANGED');
    expect(await assignmentEvents()).toHaveLength(0);
  });

  it('validates the assignment allowlist and authorizes ADMIN before validation', async () => {
    const order = await createOrder();
    const forbidden = await mechanicRequest
      .patch('/api/work-orders/not-an-id/assignment')
      .send({});
    expect(forbidden.status).toBe(403);

    const missing = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ reason: 'Missing target.' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'mechanicId' }),
    );

    const oversized = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: mechanicA.id, reason: 'x'.repeat(1001) });
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'reason' }),
    );
  });

  it('filters by assigned mechanic while keeping unassigned rows explicit', async () => {
    const assignedA = await createOrder({
      plate: 'ASN010',
      assignedMechanicId: mechanicA.id,
    });
    await createOrder({ plate: 'ASN011', assignedMechanicId: mechanicB.id });
    await createOrder({ plate: 'ASN012' });

    const filtered = await adminRequest.get('/api/work-orders').query({
      assignedMechanicId: mechanicA.id,
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body.meta.totalItems).toBe(1);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({
      id: assignedA.id,
      assignedMechanicId: mechanicA.id,
      assignedMechanic: { id: mechanicA.id, name: 'Mechanic A' },
    });

    const all = await adminRequest.get('/api/work-orders');
    expect(all.status).toBe(200);
    expect(all.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ assignedMechanicId: null, assignedMechanic: null }),
    ]));

    const invalid = await adminRequest
      .get('/api/work-orders')
      .query({ assignedMechanicId: 'not-an-id' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'assignedMechanicId' }),
    );
  });

  it('rolls back the assignment when audit persistence fails', async () => {
    const order = await createOrder();
    vi.spyOn(auditService, 'record').mockRejectedValueOnce(
      new Error('simulated assignment audit failure'),
    );

    const response = await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: mechanicA.id });
    expect(response.status).toBe(500);
    expect((await order.reload()).assignedMechanicId).toBeNull();
    expect(await assignmentEvents()).toHaveLength(0);
  });

  it('serializes concurrent reassignments so exactly one audited change commits', async () => {
    const order = await createOrder({ assignedMechanicId: mechanicA.id });
    const responses = await Promise.all([
      adminRequest
        .patch(`/api/work-orders/${order.id}/assignment`)
        .send({ mechanicId: mechanicB.id, reason: 'Assign B.' }),
      adminRequest
        .patch(`/api/work-orders/${order.id}/assignment`)
        .send({ mechanicId: mechanicC.id, reason: 'Assign C.' }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(responses.find(({ status }) => status === 409).body.error.code)
      .toBe('CONCURRENT_MODIFICATION_RETRY');

    const persisted = await order.reload();
    expect([String(mechanicB.id), String(mechanicC.id)])
      .toContain(String(persisted.assignedMechanicId));
    const events = await assignmentEvents();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.action).toBe(AUDIT_ACTION.REASSIGNED);
    expect(event.metadata.previousMechanicId).toBe(String(mechanicA.id));
    expect(event.metadata.newMechanicId).toBe(String(persisted.assignedMechanicId));
    expect(event.beforeData.assignedMechanicId).toBe(String(mechanicA.id));
    expect(event.afterData.assignedMechanicId).toBe(String(persisted.assignedMechanicId));
  });
});
