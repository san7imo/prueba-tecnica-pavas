import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { app } from '../src/app.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { env } from '../src/config/env.js';
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
let mechanicA;
let mechanicB;
let adminAccessToken;
let mechanicAAccessToken;
let mechanicBAccessToken;

const adminRequest = createAuthenticatedRequest(() => adminAccessToken);
const mechanicARequest = createAuthenticatedRequest(() => mechanicAAccessToken);
const mechanicBRequest = createAuthenticatedRequest(() => mechanicBAccessToken);

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createOrder = async ({
  plate,
  assignedMechanicId = null,
  status = WORK_ORDER_STATUS.RECEIVED,
}) => {
  const client = await models.Client.create({
    name: `Ownership Client ${plate}`,
    phone: `301${plate.replace(/\D/g, '').padEnd(7, '0')}`,
  });
  const bike = await models.Bike.create({
    plate,
    brand: 'Honda',
    model: 'CB 190R',
    clientId: client.id,
  });
  const order = await models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-09-03T18:00:00.000Z'),
    faultDescription: `Ownership test ${plate}.`,
    status,
    total: '0.00',
    assignedMechanicId,
  });
  return { client, bike, order };
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
    name: 'Ownership Admin',
    email: 'ownership.admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: mechanicA, accessToken: mechanicAAccessToken } = await createTestIdentity({
    name: 'Ownership Mechanic A',
    email: 'ownership.mechanic-a@example.test',
    role: USER_ROLE.MECHANIC,
  }));
  ({ user: mechanicB, accessToken: mechanicBAccessToken } = await createTestIdentity({
    name: 'Ownership Mechanic B',
    email: 'ownership.mechanic-b@example.test',
    role: USER_ROLE.MECHANIC,
  }));
});

beforeEach(cleanDomainData);

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 9 work-order ownership', () => {
  it('forces MECANICO to mine while ADMIN can list all, unassigned or one assignee', async () => {
    const own = await createOrder({ plate: 'OWN001', assignedMechanicId: mechanicA.id });
    await createOrder({ plate: 'OWN002', assignedMechanicId: mechanicB.id });
    await createOrder({ plate: 'OWN003' });

    for (const query of [{}, { scope: 'mine' }, { assignedMechanicId: mechanicA.id }]) {
      const response = await mechanicARequest(app).get('/api/work-orders').query(query);
      expect(response.status).toBe(200);
      expect(response.body.meta.totalItems).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(own.order.id);
    }

    for (const query of [
      { scope: 'all' },
      { scope: 'unassigned' },
      { assignedMechanicId: mechanicB.id },
    ]) {
      const response = await mechanicARequest(app).get('/api/work-orders').query(query);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }

    const all = await adminRequest(app).get('/api/work-orders');
    expect(all.status).toBe(200);
    expect(all.body.meta.totalItems).toBe(3);

    const unassigned = await adminRequest(app)
      .get('/api/work-orders')
      .query({ scope: 'unassigned' });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.meta.totalItems).toBe(1);
    expect(unassigned.body.data[0].assignedMechanicId).toBeNull();

    const assigned = await adminRequest(app)
      .get('/api/work-orders')
      .query({ assignedMechanicId: mechanicB.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.meta.totalItems).toBe(1);
    expect(assigned.body.data[0].assignedMechanicId).toBe(mechanicB.id);

    const contradictory = await adminRequest(app)
      .get('/api/work-orders')
      .query({ scope: 'unassigned', assignedMechanicId: mechanicA.id });
    expect(contradictory.status).toBe(400);
    expect(contradictory.body.error.code).toBe('INVALID_ASSIGNMENT_FILTERS');

    const invalid = await adminRequest(app)
      .get('/api/work-orders')
      .query({ scope: 'team' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'scope' }),
    );
  });

  it('limits detail and history reads to the current assigned mechanic', async () => {
    const own = await createOrder({ plate: 'OWN010', assignedMechanicId: mechanicA.id });
    const other = await createOrder({ plate: 'OWN011', assignedMechanicId: mechanicB.id });
    const unassigned = await createOrder({ plate: 'OWN012' });
    await models.WorkOrderStatusHistory.create({
      workOrderId: own.order.id,
      fromStatus: null,
      toStatus: WORK_ORDER_STATUS.RECEIVED,
      note: null,
      changedByUserId: admin.id,
    });

    await mechanicARequest(app).get(`/api/work-orders/${own.order.id}`).expect(200);
    const history = await mechanicARequest(app)
      .get(`/api/work-orders/${own.order.id}/history`);
    expect(history.status).toBe(200);
    expect(history.body.meta.totalItems).toBe(1);

    for (const orderId of [other.order.id, unassigned.order.id]) {
      const detail = await mechanicARequest(app).get(`/api/work-orders/${orderId}`);
      expect(detail.status).toBe(403);
      expect(detail.body.error.code).toBe('WORK_ORDER_NOT_ASSIGNED_TO_ACTOR');
      const deniedHistory = await mechanicARequest(app)
        .get(`/api/work-orders/${orderId}/history`);
      expect(deniedHistory.status).toBe(403);
      expect(deniedHistory.body.error.code).toBe('WORK_ORDER_NOT_ASSIGNED_TO_ACTOR');
    }

    await adminRequest(app).get(`/api/work-orders/${other.order.id}`).expect(200);
    await adminRequest(app).get(`/api/work-orders/${unassigned.order.id}`).expect(200);
    await mechanicARequest(app).get('/api/work-orders/999999').expect(404);
  });

  it('allows own item/status mutations and rejects other or unassigned work atomically', async () => {
    const own = await createOrder({ plate: 'OWN020', assignedMechanicId: mechanicA.id });
    const other = await createOrder({ plate: 'OWN021', assignedMechanicId: mechanicB.id });
    const unassigned = await createOrder({ plate: 'OWN022' });
    const itemPayload = {
      type: WORK_ORDER_ITEM_TYPE.LABOR,
      description: 'Electrical diagnosis',
      count: '1.00',
      unitValue: '45000.00',
    };

    const ownItem = await mechanicARequest(app)
      .post(`/api/work-orders/${own.order.id}/items`)
      .send(itemPayload);
    expect(ownItem.status).toBe(201);
    await mechanicARequest(app)
      .patch(`/api/work-orders/${own.order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS })
      .expect(200);

    const otherItem = await mechanicARequest(app)
      .post(`/api/work-orders/${other.order.id}/items`)
      .send(itemPayload);
    expect(otherItem.status).toBe(403);
    expect(otherItem.body.error.code).toBe('WORK_ORDER_NOT_ASSIGNED_TO_ACTOR');
    const unassignedStatus = await mechanicARequest(app)
      .patch(`/api/work-orders/${unassigned.order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS });
    expect(unassignedStatus.status).toBe(403);
    expect(unassignedStatus.body.error.code).toBe('WORK_ORDER_NOT_ASSIGNED_TO_ACTOR');

    expect(await models.WorkOrderItem.count({
      where: { workOrderId: other.order.id },
    })).toBe(0);
    expect(await models.WorkOrderStatusHistory.count({
      where: { workOrderId: unassigned.order.id },
    })).toBe(0);
    expect((await other.order.reload()).total).toBe('0.00');
    expect((await unassigned.order.reload()).status).toBe(WORK_ORDER_STATUS.RECEIVED);

    await adminRequest(app)
      .post(`/api/work-orders/${other.order.id}/items`)
      .send({ ...itemPayload, description: 'Admin diagnosis' })
      .expect(201);
  });

  it('applies reassignment immediately to reads and mutations', async () => {
    const { order } = await createOrder({
      plate: 'OWN030',
      assignedMechanicId: mechanicA.id,
    });

    await mechanicARequest(app).get(`/api/work-orders/${order.id}`).expect(200);
    await adminRequest(app)
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: mechanicB.id, reason: 'Workload redistribution.' })
      .expect(200);

    await mechanicARequest(app).get(`/api/work-orders/${order.id}`).expect(403);
    const oldOwnerMutation = await mechanicARequest(app)
      .patch(`/api/work-orders/${order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS });
    expect(oldOwnerMutation.status).toBe(403);
    expect(oldOwnerMutation.body.error.code)
      .toBe('WORK_ORDER_NOT_ASSIGNED_TO_ACTOR');

    await mechanicBRequest(app).get(`/api/work-orders/${order.id}`).expect(200);
    await mechanicBRequest(app)
      .patch(`/api/work-orders/${order.id}/status`)
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS })
      .expect(200);

    const oldOwnerList = await mechanicARequest(app).get('/api/work-orders');
    expect(oldOwnerList.body.meta.totalItems).toBe(0);
    const newOwnerList = await mechanicBRequest(app).get('/api/work-orders');
    expect(newOwnerList.body.data[0].id).toBe(order.id);
  });
});
