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
import { WORK_ORDER_STATUS } from '../src/constants/workOrder.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let adminAccessToken;
let mechanicAccessToken;
let sequence = 0;
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

const createClient = (overrides = {}) => {
  sequence += 1;
  return models.Client.create({
    name: `Bike Owner ${sequence}`,
    phone: `301${String(sequence).padStart(7, '0')}`,
    email: `bike.owner.${sequence}@example.test`,
    ...overrides,
  });
};

const bikePayload = (clientId, overrides = {}) => {
  sequence += 1;
  return {
    plate: `BKE${String(sequence).padStart(3, '0')}`,
    brand: 'Yamaha',
    model: 'FZ 2.0',
    cylinder: 149,
    clientId,
    ...overrides,
  };
};

const createBike = async (clientId, overrides = {}) => {
  const response = await adminRequest(app)
    .post('/api/bikes')
    .send(bikePayload(clientId, overrides));
  expect(response.status).toBe(201);
  return response.body.data;
};

const createOrder = (bikeId, overrides = {}) =>
  models.WorkOrder.create({
    bikeId,
    entryDate: new Date(),
    faultDescription: 'Motorcycle lifecycle fixture.',
    status: WORK_ORDER_STATUS.RECEIVED,
    total: '0.00',
    ...overrides,
  });

const deleteBike = (id, reason = 'Motorcycle retired from service.') =>
  adminRequest(app).delete(`/api/bikes/${id}`).send({ reason });

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
    name: 'Bike Lifecycle Admin',
    email: 'bike-lifecycle-admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ accessToken: mechanicAccessToken } = await createTestIdentity({
    name: 'Bike Lifecycle Mechanic',
    email: 'bike-lifecycle-mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  }));
});

beforeEach(async () => {
  sequence = 0;
  await cleanBusinessData();
});

afterEach(() => {
  models.AuditEvent.removeHook('beforeCreate', 'force-bike-audit-failure');
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('Complete Motorcycle backend lifecycle', () => {
  it('creates canonical active motorcycles and reserves plates after deletion', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id, { plate: '  abc 123  ' });
    expect(bike).toMatchObject({
      plate: 'ABC123',
      lifecycle: 'active',
      deletedAt: null,
      client: { id: owner.id, lifecycle: 'active' },
    });

    await deleteBike(bike.id).expect(200);
    const duplicate = await adminRequest(app).post('/api/bikes').send(
      bikePayload(owner.id, { plate: 'a b c 1 2 3' }),
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toEqual({
      code: 'BIKE_RESTORE_REQUIRED',
      message: 'A deleted bike already uses this plate and must be restored.',
    });
    expect(await models.Bike.count({ where: { plate: 'ABC123' } })).toBe(1);
  });

  it('paginates exact/prefix/owner searches with explicit lifecycle views', async () => {
    const firstOwner = await createClient();
    const secondOwner = await createClient();
    const bikes = [];
    for (let index = 0; index < 23; index += 1) {
      bikes.push(await models.Bike.create({
        plate: `PX${String(index).padStart(3, '0')}`,
        brand: 'Honda',
        model: 'CB',
        clientId: index < 12 ? firstOwner.id : secondOwner.id,
      }));
    }
    for (const bike of bikes.slice(-2)) {
      await bike.update({
        deletedAt: new Date(),
        deletedByUserId: admin.id,
        deleteReason: 'Archived fixture.',
      });
    }

    const page = await adminRequest(app)
      .get('/api/bikes')
      .query({ page: 2, pageSize: 10 });
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(10);
    expect(page.body.meta).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });

    const exact = await adminRequest(app).get('/api/bikes').query({ plate: 'px 001' });
    expect(exact.body.data.map(({ plate }) => plate)).toEqual(['PX001']);
    const notSubstring = await adminRequest(app).get('/api/bikes').query({ plate: 'PX0' });
    expect(notSubstring.body.data).toEqual([]);
    const prefix = await adminRequest(app)
      .get('/api/bikes')
      .query({ platePrefix: 'px00', pageSize: 100 });
    expect(prefix.body.data).toHaveLength(10);
    const wildcardPrefix = await adminRequest(app)
      .get('/api/bikes')
      .query({ platePrefix: '%', pageSize: 100 });
    expect(wildcardPrefix.body.meta.totalItems).toBe(0);

    const byOwner = await adminRequest(app)
      .get('/api/bikes')
      .query({ clientId: firstOwner.id, pageSize: 100 });
    expect(byOwner.body.data).toHaveLength(12);
    expect(byOwner.body.data.every(({ clientId }) => clientId === firstOwner.id)).toBe(true);

    const deleted = await adminRequest(app)
      .get('/api/bikes')
      .query({ lifecycle: 'deleted' });
    expect(deleted.body.meta.totalItems).toBe(2);
    expect(deleted.body.data.every(({ lifecycle }) => lifecycle === 'deleted')).toBe(true);
    const all = await adminRequest(app)
      .get('/api/bikes')
      .query({ lifecycle: 'all', pageSize: 100 });
    expect(all.body.meta.totalItems).toBe(23);

    await mechanicRequest(app).get('/api/bikes').expect(200);
    await mechanicRequest(app)
      .get('/api/bikes')
      .query({ lifecycle: 'all' })
      .expect(403);
  });

  it('rejects mutually exclusive plate filters and invalid bounded queries', async () => {
    const both = await adminRequest(app)
      .get('/api/bikes')
      .query({ plate: 'ABC123', platePrefix: 'ABC' });
    expect(both.status).toBe(400);
    expect(both.body.error).toEqual({
      code: 'INVALID_QUERY_FILTERS',
      message: 'Plate and platePrefix cannot be used together.',
    });

    for (const query of [
      { lifecycle: 'unknown' },
      { page: 0 },
      { pageSize: 101 },
      { clientId: 'not-an-id' },
    ]) {
      const response = await adminRequest(app).get('/api/bikes').query(query);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('shows the active owner, current open order and paginated order history', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    const closed = await createOrder(bike.id, {
      entryDate: new Date('2026-01-01T12:00:00.000Z'),
      faultDescription: 'Historical repair.',
      status: WORK_ORDER_STATUS.DELIVERED,
      total: '150000.00',
    });
    const open = await createOrder(bike.id, {
      entryDate: new Date('2026-02-01T12:00:00.000Z'),
      faultDescription: 'Current repair.',
      status: WORK_ORDER_STATUS.DIAGNOSIS,
      total: '25000.00',
    });

    const detail = await mechanicRequest(app).get(`/api/bikes/${bike.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: bike.id,
      client: { id: owner.id, name: owner.name, lifecycle: 'active' },
      currentOpenOrder: {
        id: open.id,
        faultDescription: 'Current repair.',
        status: WORK_ORDER_STATUS.DIAGNOSIS,
        total: '25000.00',
      },
    });

    const history = await adminRequest(app)
      .get('/api/work-orders')
      .query({ bikeId: bike.id, page: 1, pageSize: 1 });
    expect(history.status).toBe(200);
    expect(history.body.meta).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });
    expect(history.body.data[0].id).toBe(open.id);
    expect(await models.WorkOrder.findByPk(closed.id)).not.toBeNull();
  });

  it('allows both roles to read active bikes but only ADMIN to read deleted bikes', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    await mechanicRequest(app).get(`/api/bikes/${bike.id}`).expect(200);
    await deleteBike(bike.id).expect(200);

    const adminDetail = await adminRequest(app).get(`/api/bikes/${bike.id}`);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.data.lifecycle).toBe('deleted');
    await mechanicRequest(app).get(`/api/bikes/${bike.id}`).expect(403);
  });

  it('updates only general fields and emits an exact detached audit snapshot', async () => {
    const owner = await createClient();
    const otherOwner = await createClient();
    const bike = await createBike(owner.id, { plate: 'UPD001' });
    const response = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}`)
      .send({
        plate: ' upd 002 ',
        brand: '  Honda  ',
        cylinder: null,
        clientId: otherOwner.id,
        deletedAt: new Date().toISOString(),
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      plate: 'UPD002',
      brand: 'Honda',
      cylinder: null,
      clientId: owner.id,
      lifecycle: 'active',
    });

    const event = await models.AuditEvent.findOne({
      where: {
        entityType: AUDIT_ENTITY_TYPE.BIKE,
        entityId: bike.id,
        action: AUDIT_ACTION.UPDATED,
      },
    });
    expect(event.beforeData).toMatchObject({
      plate: 'UPD001',
      brand: 'Yamaha',
      cylinder: '149',
      clientId: String(owner.id),
    });
    expect(event.afterData).toMatchObject({
      plate: 'UPD002',
      brand: 'Honda',
      cylinder: null,
      clientId: String(owner.id),
    });
    expect(event.metadata).toEqual({
      changedFields: ['brand', 'cylinder', 'plate'],
    });
  });

  it('does not audit no-op updates and blocks updates while deleted', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id, { brand: 'Honda' });
    const beforeCount = await models.AuditEvent.count();
    await adminRequest(app)
      .patch(`/api/bikes/${bike.id}`)
      .send({ brand: 'Honda' })
      .expect(200);
    expect(await models.AuditEvent.count()).toBe(beforeCount);

    await deleteBike(bike.id).expect(200);
    const response = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}`)
      .send({ brand: 'Suzuki' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BIKE_INACTIVE');
  });

  it('preserves global plate uniqueness across active and deleted bikes on update', async () => {
    const owner = await createClient();
    const active = await createBike(owner.id, { plate: 'DUP001' });
    const candidate = await createBike(owner.id, { plate: 'DUP002' });
    const activeConflict = await adminRequest(app)
      .patch(`/api/bikes/${candidate.id}`)
      .send({ plate: 'dup 001' });
    expect(activeConflict.status).toBe(409);
    expect(activeConflict.body.error.code).toBe('BIKE_PLATE_ALREADY_EXISTS');

    await deleteBike(active.id).expect(200);
    const deletedConflict = await adminRequest(app)
      .patch(`/api/bikes/${candidate.id}`)
      .send({ plate: 'DUP001' });
    expect(deletedConflict.status).toBe(409);
    expect(deletedConflict.body.error.code).toBe('BIKE_RESTORE_REQUIRED');
  });

  it('changes owner only through the dedicated justified audited operation', async () => {
    const originalOwner = await createClient();
    const destinationOwner = await createClient();
    const bike = await createBike(originalOwner.id, { plate: 'OWN001' });
    const historicalOrder = await createOrder(bike.id, {
      status: WORK_ORDER_STATUS.DELIVERED,
    });

    const missingReason = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({ clientId: destinationOwner.id });
    expect(missingReason.status).toBe(400);

    const response = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({
        clientId: destinationOwner.id,
        reason: 'Ownership transfer documented by the workshop.',
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      clientId: destinationOwner.id,
      client: { id: destinationOwner.id, name: destinationOwner.name },
    });
    expect((await models.WorkOrder.findByPk(historicalOrder.id)).bikeId).toBe(bike.id);

    const event = await models.AuditEvent.findOne({
      where: {
        entityType: AUDIT_ENTITY_TYPE.BIKE,
        entityId: bike.id,
        action: AUDIT_ACTION.OWNER_CHANGED,
      },
    });
    expect(event).toMatchObject({
      actorUserId: admin.id,
      reason: 'Ownership transfer documented by the workshop.',
      metadata: {
        previousClientId: String(originalOwner.id),
        newClientId: String(destinationOwner.id),
      },
    });
    expect(event.beforeData.clientId).toBe(String(originalOwner.id));
    expect(event.afterData.clientId).toBe(String(destinationOwner.id));
  });

  it('rejects missing or inactive destination owners and deleted motorcycles', async () => {
    const owner = await createClient();
    const inactiveOwner = await createClient({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Inactive owner fixture.',
    });
    const bike = await createBike(owner.id);

    const missing = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({ clientId: '999999', reason: 'Missing destination.' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('CLIENT_NOT_FOUND');

    const inactive = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({ clientId: inactiveOwner.id, reason: 'Invalid destination.' });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe('CLIENT_INACTIVE');

    await deleteBike(bike.id).expect(200);
    const deleted = await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({ clientId: owner.id, reason: 'Must restore first.' });
    expect(deleted.status).toBe(409);
    expect(deleted.body.error.code).toBe('BIKE_INACTIVE');
  });

  it('blocks soft delete while an order is open and allows it after closure', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    const order = await createOrder(bike.id);

    const blocked = await deleteBike(bike.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('BIKE_HAS_ACTIVE_WORK_ORDER');
    expect((await models.Bike.findByPk(bike.id)).deletedAt).toBeNull();

    await order.update({ status: WORK_ORDER_STATUS.DELIVERED });
    const deleted = await deleteBike(bike.id, 'Closed history is preserved.');
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toMatchObject({
      lifecycle: 'deleted',
      deletedByUserId: admin.id,
      deleteReason: 'Closed history is preserved.',
    });
    expect(await models.WorkOrder.findByPk(order.id)).not.toBeNull();

    const repeated = await deleteBike(bike.id);
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('BIKE_ALREADY_DELETED');
  });

  it('restores the same identity only while its owner is active', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id, { plate: 'RST001' });
    await deleteBike(bike.id, 'Temporary retirement.').expect(200);

    const restored = await adminRequest(app)
      .post(`/api/bikes/${bike.id}/restore`)
      .send({ reason: 'Motorcycle returned to service.' });
    expect(restored.status).toBe(200);
    expect(restored.body.data).toMatchObject({
      id: bike.id,
      plate: 'RST001',
      clientId: owner.id,
      lifecycle: 'active',
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    });

    const event = await models.AuditEvent.findOne({
      where: {
        entityType: AUDIT_ENTITY_TYPE.BIKE,
        entityId: bike.id,
        action: AUDIT_ACTION.RESTORED,
      },
    });
    expect(event.reason).toBe('Motorcycle returned to service.');
    expect(event.beforeData.deleteReason).toBe('Temporary retirement.');
    expect(event.afterData.deletedAt).toBeNull();

    const repeated = await adminRequest(app)
      .post(`/api/bikes/${bike.id}/restore`)
      .send({ reason: 'Already active.' });
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('BIKE_NOT_DELETED');
  });

  it('blocks restoration when the linked owner is deleted', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    await deleteBike(bike.id).expect(200);
    await adminRequest(app)
      .delete(`/api/clients/${owner.id}`)
      .send({ reason: 'Owner archived after bike deletion.' })
      .expect(200);

    const response = await adminRequest(app)
      .post(`/api/bikes/${bike.id}/restore`)
      .send({ reason: 'Invalid while owner is inactive.' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BIKE_OWNER_INACTIVE');
    expect((await models.Bike.findByPk(bike.id)).deletedAt).not.toBeNull();
  });

  it('prevents new work orders from using a deleted motorcycle', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    await deleteBike(bike.id).expect(200);

    const response = await adminRequest(app).post('/api/work-orders').send({
      bikeId: bike.id,
      faultDescription: 'Must not use an inactive motorcycle.',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BIKE_INACTIVE');
    expect(await models.WorkOrder.count()).toBe(0);
  });

  it('enforces ADMIN mutation authorization before request validation', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    const operations = [
      mechanicRequest(app).post('/api/bikes').send({}),
      mechanicRequest(app).patch(`/api/bikes/${bike.id}`).send({}),
      mechanicRequest(app).patch(`/api/bikes/${bike.id}/owner`).send({}),
      mechanicRequest(app).delete(`/api/bikes/${bike.id}`).send({}),
      mechanicRequest(app).post(`/api/bikes/${bike.id}/restore`).send({}),
    ];
    for (const operation of operations) {
      const response = await operation;
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('rolls back update, owner change, delete and restore when audit fails', async () => {
    const owner = await createClient();
    const destinationOwner = await createClient();
    const bike = await createBike(owner.id, { plate: 'RBK001' });
    models.AuditEvent.addHook('beforeCreate', 'force-bike-audit-failure', () => {
      throw new Error('Forced bike audit failure');
    });

    await adminRequest(app)
      .patch(`/api/bikes/${bike.id}`)
      .send({ brand: 'Must roll back' })
      .expect(500);
    let persisted = await models.Bike.findByPk(bike.id);
    expect(persisted.brand).toBe('Yamaha');

    await adminRequest(app)
      .patch(`/api/bikes/${bike.id}/owner`)
      .send({ clientId: destinationOwner.id, reason: 'Must roll back.' })
      .expect(500);
    persisted = await models.Bike.findByPk(bike.id);
    expect(persisted.clientId).toBe(owner.id);

    await deleteBike(bike.id, 'Must roll back.').expect(500);
    persisted = await models.Bike.findByPk(bike.id);
    expect(persisted.deletedAt).toBeNull();

    await persisted.update({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Direct deleted fixture.',
    });
    await adminRequest(app)
      .post(`/api/bikes/${bike.id}/restore`)
      .send({ reason: 'Must roll back.' })
      .expect(500);
    persisted = await models.Bike.findByPk(bike.id);
    expect(persisted.deletedAt).not.toBeNull();
    expect(persisted.deleteReason).toBe('Direct deleted fixture.');
  });

  it('serializes bike deletion against work-order creation', async () => {
    const owner = await createClient();
    const bike = await createBike(owner.id);
    const [deleteResponse, orderResponse] = await Promise.all([
      deleteBike(bike.id, 'Concurrent deletion.'),
      adminRequest(app).post('/api/work-orders').send({
        bikeId: bike.id,
        faultDescription: 'Concurrent order creation.',
      }),
    ]);
    expect([200, 409]).toContain(deleteResponse.status);
    expect([201, 409]).toContain(orderResponse.status);
    expect([deleteResponse.status, orderResponse.status].filter((status) =>
      status < 300)).toHaveLength(1);

    const persisted = await models.Bike.findByPk(bike.id);
    const openOrders = await models.WorkOrder.count({ where: { bikeId: bike.id } });
    expect(persisted.deletedAt !== null && openOrders > 0).toBe(false);
  });

  it('serializes owner change against deletion of the destination client', async () => {
    const originalOwner = await createClient();
    const destinationOwner = await createClient();
    const bike = await createBike(originalOwner.id);
    const [ownerResponse, deleteClientResponse] = await Promise.all([
      adminRequest(app)
        .patch(`/api/bikes/${bike.id}/owner`)
        .send({ clientId: destinationOwner.id, reason: 'Concurrent transfer.' }),
      adminRequest(app)
        .delete(`/api/clients/${destinationOwner.id}`)
        .send({ reason: 'Concurrent owner deletion.' }),
    ]);
    expect([200, 409]).toContain(ownerResponse.status);
    expect([200, 409]).toContain(deleteClientResponse.status);
    expect([ownerResponse.status, deleteClientResponse.status].filter((status) =>
      status < 300)).toHaveLength(1);

    const persistedBike = await models.Bike.findByPk(bike.id);
    const persistedDestination = await models.Client.findByPk(destinationOwner.id);
    expect(
      String(persistedBike.clientId) === String(destinationOwner.id) &&
        persistedDestination.deletedAt !== null,
    ).toBe(false);
  });
});
