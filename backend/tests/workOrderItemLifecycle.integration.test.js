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
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_REOPEN_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let mechanic;
let otherMechanic;
let adminRequest;
let mechanicRequest;
let otherMechanicRequest;
let sequence = 0;

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createOrder = async ({
  status = WORK_ORDER_STATUS.RECEIVED,
  total = '0.00',
  assignedMechanicId = mechanic.id,
} = {}) => {
  sequence += 1;
  const suffix = String(sequence).padStart(3, '0');
  const client = await models.Client.create({
    name: `Item Lifecycle Client ${suffix}`,
    phone: `3200000${suffix}`,
  });
  const bike = await models.Bike.create({
    plate: `ITM${suffix}`,
    brand: 'Honda',
    model: 'CB 190R',
    clientId: client.id,
  });
  const order = await models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-09-03T18:00:00.000Z'),
    faultDescription: `Item lifecycle test ${suffix}.`,
    status,
    total,
    assignedMechanicId,
  });
  return { client, bike, order };
};

const itemPayload = (overrides = {}) => ({
  type: WORK_ORDER_ITEM_TYPE.LABOR,
  description: 'Electrical diagnosis',
  count: '1.00',
  unitValue: '100.00',
  ...overrides,
});

const addItem = (request, orderId, overrides = {}) =>
  request.post(`/api/work-orders/${orderId}/items`).send(itemPayload(overrides));

const createPersistedItem = (orderId, overrides = {}) =>
  models.WorkOrderItem.create({
    workOrderId: orderId,
    type: WORK_ORDER_ITEM_TYPE.PART,
    description: 'Persisted part',
    count: '1.00',
    unitValue: '100.00',
    createdByUserId: mechanic.id,
    ...overrides,
  });

const itemEvents = (action) =>
  models.AuditEvent.findAll({
    where: {
      entityType: AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM,
      action,
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
    name: 'Item Lifecycle Admin',
    email: 'item.lifecycle.admin@example.test',
    role: USER_ROLE.ADMIN,
  });
  admin = adminIdentity.user;
  adminRequest = createAuthenticatedRequest(() => adminIdentity.accessToken)(app);

  const mechanicIdentity = await createTestIdentity({
    name: 'Item Lifecycle Mechanic',
    email: 'item.lifecycle.mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  });
  mechanic = mechanicIdentity.user;
  mechanicRequest = createAuthenticatedRequest(
    () => mechanicIdentity.accessToken,
  )(app);

  const otherMechanicIdentity = await createTestIdentity({
    name: 'Other Item Mechanic',
    email: 'item.lifecycle.other@example.test',
    role: USER_ROLE.MECHANIC,
  });
  otherMechanic = otherMechanicIdentity.user;
  otherMechanicRequest = createAuthenticatedRequest(
    () => otherMechanicIdentity.accessToken,
  )(app);
});

beforeEach(cleanDomainData);

afterEach(() => {
  models.AuditEvent.removeHook('beforeCreate', 'force-item-audit-failure');
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 12 work-order item lifecycle', () => {
  it('attributes ADMIN and assigned MECANICO items from authentication only', async () => {
    const { order } = await createOrder();

    const adminResponse = await addItem(adminRequest, order.id, {
      description: 'Admin inspection',
      createdByUserId: otherMechanic.id,
    });
    const mechanicResponse = await addItem(mechanicRequest, order.id, {
      description: 'Mechanic diagnosis',
      createdByUserId: admin.id,
    });

    expect(adminResponse.status).toBe(201);
    expect(adminResponse.body.data.item).toMatchObject({
      createdByUserId: admin.id,
      createdBy: { id: admin.id, name: admin.name },
    });
    expect(mechanicResponse.status).toBe(201);
    expect(mechanicResponse.body.data.item).toMatchObject({
      createdByUserId: mechanic.id,
      createdBy: { id: mechanic.id, name: mechanic.name },
    });

    const persisted = await models.WorkOrderItem.findAll({
      where: { workOrderId: order.id },
      order: [['id', 'ASC']],
    });
    expect(persisted.map(({ createdByUserId }) => createdByUserId)).toEqual([
      admin.id,
      mechanic.id,
    ]);
    const events = await itemEvents(AUDIT_ACTION.ITEM_ADDED);
    expect(events.map(({ actorUserId }) => actorUserId)).toEqual([
      admin.id,
      mechanic.id,
    ]);
    expect(events.map(({ afterData }) => afterData.createdByUserId)).toEqual([
      String(admin.id),
      String(mechanic.id),
    ]);
    expect((await order.reload()).total).toBe('200.00');
  });

  it('returns safe creator data while preserving nullable legacy attribution', async () => {
    const { order } = await createOrder({ assignedMechanicId: null });
    await createPersistedItem(order.id, {
      description: 'Legacy unattributed part',
      createdByUserId: null,
    });
    await order.update({ total: '100.00' });

    const detail = await adminRequest.get(`/api/work-orders/${order.id}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.items[0]).toMatchObject({
      createdByUserId: null,
      createdBy: null,
    });
    expect(JSON.stringify(detail.body.data.items[0])).not.toContain('email');
  });

  it.each([
    WORK_ORDER_STATUS.DELIVERED,
    WORK_ORDER_STATUS.CANCELLED,
  ])('rejects item creation on a %s order for both roles', async (status) => {
    const { order } = await createOrder({ status });

    for (const request of [adminRequest, mechanicRequest]) {
      const response = await addItem(request, order.id);
      expect(response.status).toBe(409);
      expect(response.body.error).toEqual({
        code: 'WORK_ORDER_CLOSED',
        message: 'Closed work orders cannot be modified.',
      });
    }

    expect(await models.WorkOrderItem.count()).toBe(0);
    expect(await models.AuditEvent.count()).toBe(0);
    expect((await order.reload()).total).toBe('0.00');
  });

  it.each([
    WORK_ORDER_STATUS.DELIVERED,
    WORK_ORDER_STATUS.CANCELLED,
  ])('rejects item deletion on a %s order without changing history', async (status) => {
    const { order } = await createOrder({ status, total: '100.00' });
    const item = await createPersistedItem(order.id);

    const response = await adminRequest.delete(`/api/work-orders/items/${item.id}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('WORK_ORDER_CLOSED');
    expect(await models.WorkOrderItem.count({ where: { id: item.id } })).toBe(1);
    expect((await order.reload()).total).toBe('100.00');
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('keeps item deletion ADMIN-only before validating the item id', async () => {
    const response = await otherMechanicRequest.delete(
      '/api/work-orders/items/not-an-id',
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('re-enables permitted add/delete after a delivered order is reopened', async () => {
    const { order } = await createOrder({
      status: WORK_ORDER_STATUS.DELIVERED,
      total: '0.00',
    });
    const reopen = await adminRequest
      .post(`/api/work-orders/${order.id}/reopen`)
      .send({
        type: WORK_ORDER_REOPEN_TYPE.WARRANTY,
        reason: 'The repaired failure returned under warranty.',
      });
    const added = await addItem(mechanicRequest, order.id, {
      count: '2.00',
      unitValue: '75.25',
    });
    const deleted = await adminRequest.delete(
      `/api/work-orders/items/${added.body.data.item.id}`,
    );

    expect(reopen.status).toBe(200);
    expect(added.status).toBe(201);
    expect(added.body.data.workOrderTotal).toBe('150.50');
    expect(added.body.data.item.createdByUserId).toBe(mechanic.id);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.workOrderTotal).toBe('0.00');
    expect((await order.reload()).status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(order.total).toBe('0.00');

    const deletedEvents = await itemEvents(AUDIT_ACTION.ITEM_DELETED);
    expect(deletedEvents).toHaveLength(1);
    expect(deletedEvents[0]).toMatchObject({
      actorUserId: admin.id,
      afterData: null,
    });
    expect(deletedEvents[0].beforeData).toMatchObject({
      id: String(added.body.data.item.id),
      workOrderId: String(order.id),
      count: '2.00',
      unitValue: '75.25',
      createdByUserId: String(mechanic.id),
    });
  });

  it('rolls back deletion and total when ITEM_DELETED audit fails', async () => {
    const { order } = await createOrder({ total: '100.00' });
    const item = await createPersistedItem(order.id);
    models.AuditEvent.addHook(
      'beforeCreate',
      'force-item-audit-failure',
      () => { throw new Error('Forced item audit failure'); },
    );

    const response = await adminRequest.delete(`/api/work-orders/items/${item.id}`);

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toContain('Forced');
    expect(await models.WorkOrderItem.count({ where: { id: item.id } })).toBe(1);
    expect((await order.reload()).total).toBe('100.00');
    expect(await models.AuditEvent.count()).toBe(0);
  });

  it('does not expose an item-update endpoint', async () => {
    const { order } = await createOrder({ total: '100.00' });
    const item = await createPersistedItem(order.id);

    const response = await adminRequest
      .patch(`/api/work-orders/items/${item.id}`)
      .send({ description: 'Historical rewrite attempt.' });

    expect(response.status).toBe(404);
    expect((await item.reload()).description).toBe('Persisted part');
    expect((await order.reload()).total).toBe('100.00');
  });

  it('serializes item creation against delivery and preserves the exact total', async () => {
    const { order } = await createOrder({ status: WORK_ORDER_STATUS.READY });

    const [addResponse, deliveryResponse] = await Promise.all([
      addItem(adminRequest, order.id),
      adminRequest.patch(`/api/work-orders/${order.id}/status`).send({
        toStatus: WORK_ORDER_STATUS.DELIVERED,
      }),
    ]);

    expect(deliveryResponse.status).toBe(200);
    expect([201, 409]).toContain(addResponse.status);
    await order.reload();
    const itemCount = await models.WorkOrderItem.count({
      where: { workOrderId: order.id },
    });
    expect(order.status).toBe(WORK_ORDER_STATUS.DELIVERED);
    expect(order.total).toBe(itemCount === 1 ? '100.00' : '0.00');
    expect(itemCount).toBe(addResponse.status === 201 ? 1 : 0);
  });

  it('serializes item deletion against cancellation without corrupting total', async () => {
    const { order } = await createOrder({ total: '100.00' });
    const item = await createPersistedItem(order.id);

    const [deleteResponse, cancelResponse] = await Promise.all([
      adminRequest.delete(`/api/work-orders/items/${item.id}`),
      adminRequest.patch(`/api/work-orders/${order.id}/status`).send({
        toStatus: WORK_ORDER_STATUS.CANCELLED,
      }),
    ]);

    expect(cancelResponse.status).toBe(200);
    expect([200, 409]).toContain(deleteResponse.status);
    await order.reload();
    const itemCount = await models.WorkOrderItem.count({
      where: { workOrderId: order.id },
    });
    expect(order.status).toBe(WORK_ORDER_STATUS.CANCELLED);
    expect(order.total).toBe(itemCount === 1 ? '100.00' : '0.00');
    expect(itemCount).toBe(deleteResponse.status === 200 ? 0 : 1);
  });

  it('serializes item creation against reopen and applies the confirmed state', async () => {
    const { order } = await createOrder({ status: WORK_ORDER_STATUS.DELIVERED });

    const [addResponse, reopenResponse] = await Promise.all([
      addItem(adminRequest, order.id),
      adminRequest.post(`/api/work-orders/${order.id}/reopen`).send({
        type: WORK_ORDER_REOPEN_TYPE.SAME_ISSUE,
        reason: 'Concurrent same-issue return.',
      }),
    ]);

    expect(reopenResponse.status).toBe(200);
    expect([201, 409]).toContain(addResponse.status);
    await order.reload();
    const itemCount = await models.WorkOrderItem.count({
      where: { workOrderId: order.id },
    });
    expect(order.status).toBe(WORK_ORDER_STATUS.DIAGNOSIS);
    expect(order.total).toBe(itemCount === 1 ? '100.00' : '0.00');
    expect(itemCount).toBe(addResponse.status === 201 ? 1 : 0);
  });
});
