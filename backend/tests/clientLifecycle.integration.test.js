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
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../src/constants/audit.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let mechanic;
let adminAccessToken;
let mechanicAccessToken;
let clientSequence = 0;
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

const nextClientPayload = (overrides = {}) => {
  clientSequence += 1;
  const suffix = String(clientSequence).padStart(4, '0');
  return {
    name: `Lifecycle Client ${clientSequence}`,
    phone: `300000${suffix}`,
    email: `lifecycle.client.${clientSequence}@example.test`,
    ...overrides,
  };
};

const createClient = async (overrides = {}) => {
  const response = await adminRequest(app)
    .post('/api/clients')
    .send(nextClientPayload(overrides));
  expect(response.status).toBe(201);
  return response.body.data;
};

const deleteClient = (id, reason = 'No longer operational.') =>
  adminRequest(app).delete(`/api/clients/${id}`).send({ reason });

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
    name: 'Client Lifecycle Admin',
    email: 'client-lifecycle-admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: mechanic, accessToken: mechanicAccessToken } = await createTestIdentity({
    name: 'Client Lifecycle Mechanic',
    email: 'client-lifecycle-mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  }));
});

beforeEach(async () => {
  clientSequence = 0;
  await cleanBusinessData();
});

afterEach(() => {
  models.AuditEvent.removeHook('beforeCreate', 'force-client-audit-failure');
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('Complete Client backend lifecycle', () => {
  it('canonicalizes phone/email and rejects invalid canonical phones', async () => {
    const created = await createClient({
      phone: ' +57 (300) 123-45.67 ',
      email: '  SHARED@EXAMPLE.TEST  ',
    });
    expect(created).toMatchObject({
      phone: '+573001234567',
      email: 'shared@example.test',
      lifecycle: 'active',
      deletedAt: null,
    });

    for (const phone of [
      '123456',
      '123456789012345678901',
      '++573001234567',
      '+57ABC123',
    ]) {
      const response = await adminRequest(app)
        .post('/api/clients')
        .send(nextClientPayload({ phone }));
      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'phone' }),
      );
    }
  });

  it('allows equal names but returns safe active duplicate conflicts by contact', async () => {
    const first = await createClient({
      name: 'Shared Name',
      phone: '3001234567',
      email: 'first@example.test',
    });
    await createClient({
      name: 'Shared Name',
      phone: '3007654321',
      email: 'second@example.test',
    });

    const byPhone = await adminRequest(app).post('/api/clients').send(
      nextClientPayload({
        phone: '300-123-4567',
        email: 'third@example.test',
      }),
    );
    expect(byPhone.status).toBe(409);
    expect(byPhone.body.error).toEqual({
      code: 'CLIENT_DUPLICATE_RISK',
      message: 'An active client already uses this contact data.',
      details: {
        candidateIds: [String(first.id)],
        matchedFields: ['phone'],
      },
    });

    const byEmail = await adminRequest(app).post('/api/clients').send(
      nextClientPayload({
        phone: '3019998877',
        email: ' FIRST@EXAMPLE.TEST ',
      }),
    );
    expect(byEmail.status).toBe(409);
    expect(byEmail.body.error.details).toEqual({
      candidateIds: [String(first.id)],
      matchedFields: ['email'],
    });
  });

  it('requires a justified override and audits an intentional active duplicate', async () => {
    const first = await createClient({
      phone: '3001234567',
      email: 'family@example.test',
    });
    const missingReason = await adminRequest(app).post('/api/clients').send(
      nextClientPayload({
        phone: first.phone,
        email: 'another@example.test',
        confirmDuplicate: true,
      }),
    );
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'duplicateReason' }),
    );

    const response = await adminRequest(app).post('/api/clients').send(
      nextClientPayload({
        phone: first.phone,
        email: 'another@example.test',
        confirmDuplicate: true,
        duplicateReason: 'Two relatives share this contact number.',
      }),
    );
    expect(response.status).toBe(201);
    const event = await models.AuditEvent.findOne({
      where: {
        entityType: AUDIT_ENTITY_TYPE.CLIENT,
        entityId: response.body.data.id,
        action: AUDIT_ACTION.CREATED,
      },
    });
    expect(event).toMatchObject({
      actorUserId: admin.id,
      reason: 'Two relatives share this contact number.',
      metadata: {
        duplicateOverride: true,
        candidateIds: [String(first.id)],
        matchedFields: ['phone'],
      },
    });
  });

  it('requires restore instead of allowing a duplicate of a deleted client', async () => {
    const deleted = await createClient({
      phone: '3001234567',
      email: 'deleted@example.test',
    });
    await deleteClient(deleted.id).expect(200);

    const response = await adminRequest(app).post('/api/clients').send(
      nextClientPayload({
        phone: deleted.phone,
        email: 'different@example.test',
        confirmDuplicate: true,
        duplicateReason: 'Must not override a deleted match.',
      }),
    );
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'CLIENT_RESTORE_REQUIRED',
      message: 'A deleted client already uses this contact data and must be restored.',
      details: {
        candidateIds: [String(deleted.id)],
        matchedFields: ['phone'],
      },
    });
  });

  it('paginates/searches active clients and gives ADMIN explicit lifecycle views', async () => {
    const clients = [];
    for (let index = 0; index < 23; index += 1) {
      clients.push(await models.Client.create(nextClientPayload({
        name: `Client ${String(index).padStart(2, '0')}`,
      })));
    }
    for (const client of clients.slice(-2)) {
      await client.update({
        deletedAt: new Date(),
        deletedByUserId: admin.id,
        deleteReason: 'Archived fixture.',
      });
    }

    const firstPage = await adminRequest(app)
      .get('/api/clients')
      .query({ page: 1, pageSize: 10 });
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(10);
    expect(firstPage.body.meta).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });
    expect(firstPage.body.data[0].name).toBe('Client 00');

    const deletedPage = await adminRequest(app)
      .get('/api/clients')
      .query({ lifecycle: 'deleted' });
    expect(deletedPage.status).toBe(200);
    expect(deletedPage.body.meta.totalItems).toBe(2);
    expect(deletedPage.body.data.every(({ lifecycle }) =>
      lifecycle === 'deleted')).toBe(true);

    const allPage = await adminRequest(app)
      .get('/api/clients')
      .query({ lifecycle: 'all', pageSize: 100 });
    expect(allPage.body.meta.totalItems).toBe(23);

    const phoneSearch = await adminRequest(app)
      .get('/api/clients')
      .query({ search: clients[0].phone.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3') });
    expect(phoneSearch.status).toBe(200);
    expect(phoneSearch.body.data).toHaveLength(1);
    expect(phoneSearch.body.data[0].id).toBe(clients[0].id);
  });

  it('validates lifecycle and bounded pagination filters', async () => {
    const response = await adminRequest(app).get('/api/clients').query({
      lifecycle: 'archived',
      page: 0,
      pageSize: 101,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map(({ field }) => field)).toEqual(
      expect.arrayContaining(['lifecycle', 'page', 'pageSize']),
    );
  });

  it('allows both roles to read active clients but protects deleted views/details', async () => {
    const active = await createClient();
    await mechanicRequest(app).get('/api/clients').expect(200);
    await mechanicRequest(app).get(`/api/clients/${active.id}`).expect(200);
    await mechanicRequest(app)
      .get('/api/clients')
      .query({ lifecycle: 'deleted' })
      .expect(403);
    await mechanicRequest(app)
      .get('/api/clients')
      .query({ lifecycle: 'all' })
      .expect(403);

    await deleteClient(active.id, 'Hidden historical client.').expect(200);
    const adminDetail = await adminRequest(app).get(`/api/clients/${active.id}`);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.data).toMatchObject({
      lifecycle: 'deleted',
      deletedByUserId: admin.id,
      deleteReason: 'Hidden historical client.',
    });
    await mechanicRequest(app).get(`/api/clients/${active.id}`).expect(403);
  });

  it('prevents a deleted client from receiving a new motorcycle', async () => {
    const client = await createClient();
    await deleteClient(client.id, 'No longer operational.').expect(200);

    const response = await adminRequest(app).post('/api/bikes').send({
      plate: 'INA001',
      brand: 'Honda',
      model: 'XR',
      clientId: client.id,
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'CLIENT_INACTIVE',
      message: 'Deleted clients cannot receive new motorcycles.',
    });
    expect(await models.Bike.count()).toBe(0);
  });

  it('updates allowed fields, can clear email and audits only effective changes', async () => {
    const client = await createClient();
    const response = await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({
        name: '  Updated Client  ',
        phone: ' +57 (301) 222-33.44 ',
        email: '  UPDATED@EXAMPLE.TEST ',
        deletedAt: '2020-01-01T00:00:00.000Z',
        deletedByUserId: mechanic.id,
      });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: 'Updated Client',
      phone: '+573012223344',
      email: 'updated@example.test',
      lifecycle: 'active',
      deletedAt: null,
    });
    const event = await models.AuditEvent.findOne({
      where: { entityId: client.id, action: AUDIT_ACTION.UPDATED },
    });
    expect(event.metadata).toEqual({
      changedFields: ['email', 'name', 'phone'],
    });
    expect(event.beforeData).toMatchObject({
      name: client.name,
      phone: client.phone,
      email: client.email,
    });
    expect(event.afterData).toMatchObject({
      name: 'Updated Client',
      phone: '+573012223344',
      email: 'updated@example.test',
    });

    await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({ email: null })
      .expect(200)
      .expect(({ body }) => expect(body.data.email).toBeNull());
  });

  it('does not audit a no-op update and rejects updates to deleted clients', async () => {
    const client = await createClient();
    await models.AuditEvent.destroy({
      where: { entityType: AUDIT_ENTITY_TYPE.CLIENT },
      force: true,
    });
    await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({ name: client.name, phone: client.phone, email: client.email })
      .expect(200);
    expect(await models.AuditEvent.count()).toBe(0);

    await deleteClient(client.id).expect(200);
    const response = await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({ name: 'Forbidden update' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CLIENT_INACTIVE');
  });

  it('applies duplicate-risk rules to changed contacts and audits an override', async () => {
    const first = await createClient({
      phone: '3001234567',
      email: 'first@example.test',
    });
    const second = await createClient({
      phone: '3007654321',
      email: 'second@example.test',
    });
    const conflict = await adminRequest(app)
      .patch(`/api/clients/${second.id}`)
      .send({ phone: '300-123-4567' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.details).toEqual({
      candidateIds: [String(first.id)],
      matchedFields: ['phone'],
    });

    const updated = await adminRequest(app)
      .patch(`/api/clients/${second.id}`)
      .send({
        phone: first.phone,
        confirmDuplicate: true,
        duplicateReason: 'The company owns both client records.',
      });
    expect(updated.status).toBe(200);
    const event = await models.AuditEvent.findOne({
      where: { entityId: second.id, action: AUDIT_ACTION.UPDATED },
      order: [['id', 'DESC']],
    });
    expect(event).toMatchObject({
      reason: 'The company owns both client records.',
      metadata: {
        changedFields: ['phone'],
        duplicateOverride: true,
        candidateIds: [String(first.id)],
        matchedFields: ['phone'],
      },
    });

    await deleteClient(first.id).expect(200);
    const deletedConflict = await adminRequest(app)
      .patch(`/api/clients/${second.id}`)
      .send({ email: first.email });
    expect(deletedConflict.status).toBe(409);
    expect(deletedConflict.body.error.code).toBe('CLIENT_RESTORE_REQUIRED');
  });

  it('soft deletes without physical deletion and blocks active motorcycle owners', async () => {
    const client = await createClient();
    const bike = await models.Bike.create({
      plate: 'CLD001',
      brand: 'Honda',
      model: 'CB',
      clientId: client.id,
    });
    const blocked = await deleteClient(client.id, 'Cannot delete yet.');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CLIENT_HAS_ACTIVE_BIKES');

    await bike.update({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Archived motorcycle fixture.',
    });
    const deleted = await deleteClient(client.id, 'Customer requested archival.');
    expect(deleted.status).toBe(200);
    expect(deleted.body.data).toMatchObject({
      id: client.id,
      lifecycle: 'deleted',
      deletedAt: expect.any(String),
      deletedByUserId: admin.id,
      deleteReason: 'Customer requested archival.',
    });
    expect(await models.Client.findByPk(client.id)).not.toBeNull();
    const event = await models.AuditEvent.findOne({
      where: { entityId: client.id, action: AUDIT_ACTION.SOFT_DELETED },
    });
    expect(event).toMatchObject({
      actorUserId: admin.id,
      reason: 'Customer requested archival.',
    });
    expect(event.beforeData.deletedAt).toBeNull();
    expect(event.afterData.deletedAt).toEqual(expect.any(String));

    const repeated = await deleteClient(client.id, 'Repeat.');
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('CLIENT_ALREADY_DELETED');
  });

  it('requires delete/restore reasons and validates patch allowlists', async () => {
    const client = await createClient();
    await adminRequest(app).delete(`/api/clients/${client.id}`).send({}).expect(400);
    await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({ deletedAt: new Date().toISOString() })
      .expect(400);
    await adminRequest(app)
      .post(`/api/clients/${client.id}/restore`)
      .send({})
      .expect(400);
  });

  it('restores lifecycle fields without restoring linked motorcycles', async () => {
    const client = await createClient();
    const bike = await models.Bike.create({
      plate: 'CLR001',
      brand: 'Yamaha',
      model: 'FZ',
      clientId: client.id,
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Archived before client.',
    });
    await deleteClient(client.id, 'Temporary archival.').expect(200);

    const restored = await adminRequest(app)
      .post(`/api/clients/${client.id}/restore`)
      .send({ reason: 'Customer returned.' });
    expect(restored.status).toBe(200);
    expect(restored.body.data).toMatchObject({
      lifecycle: 'active',
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    });
    await bike.reload();
    expect(bike.deletedAt).not.toBeNull();

    const event = await models.AuditEvent.findOne({
      where: { entityId: client.id, action: AUDIT_ACTION.RESTORED },
    });
    expect(event).toMatchObject({
      reason: 'Customer returned.',
      metadata: null,
    });
    expect(event.beforeData.deleteReason).toBe('Temporary archival.');
    expect(event.afterData).toMatchObject({
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    });

    const repeated = await adminRequest(app)
      .post(`/api/clients/${client.id}/restore`)
      .send({ reason: 'Already active.' });
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('CLIENT_NOT_DELETED');
  });

  it('requires and audits a justified duplicate override during restore', async () => {
    const deleted = await createClient({
      phone: '3001234567',
      email: 'shared.restore@example.test',
    });
    await deleteClient(deleted.id, 'Archived temporarily.').expect(200);
    const active = await models.Client.create({
      name: 'Legacy active duplicate',
      phone: deleted.phone,
      email: 'other@example.test',
    });

    const conflict = await adminRequest(app)
      .post(`/api/clients/${deleted.id}/restore`)
      .send({ reason: 'Customer returned.' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CLIENT_DUPLICATE_RISK');

    const restored = await adminRequest(app)
      .post(`/api/clients/${deleted.id}/restore`)
      .send({
        reason: 'Customer returned.',
        confirmDuplicate: true,
        duplicateReason: 'Household members intentionally share this phone.',
      });
    expect(restored.status).toBe(200);
    const event = await models.AuditEvent.findOne({
      where: { entityId: deleted.id, action: AUDIT_ACTION.RESTORED },
    });
    expect(event).toMatchObject({
      reason: 'Customer returned.',
      metadata: {
        duplicateOverride: true,
        candidateIds: [String(active.id)],
        matchedFields: ['phone'],
        duplicateReason: 'Household members intentionally share this phone.',
      },
    });
  });

  it('enforces ADMIN mutation authorization before request validation', async () => {
    const client = await createClient();
    await mechanicRequest(app).post('/api/clients').send({}).expect(403);
    await mechanicRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({})
      .expect(403);
    await mechanicRequest(app)
      .delete(`/api/clients/${client.id}`)
      .send({})
      .expect(403);
    await mechanicRequest(app)
      .post(`/api/clients/${client.id}/restore`)
      .send({})
      .expect(403);
    await request(app).patch(`/api/clients/${client.id}`).send({}).expect(401);
  });

  it('rolls back update, delete and restore when auditing fails', async () => {
    const client = await createClient();
    models.AuditEvent.addHook('beforeCreate', 'force-client-audit-failure', () => {
      throw new Error('Forced client audit failure');
    });

    await adminRequest(app)
      .patch(`/api/clients/${client.id}`)
      .send({ name: 'Must roll back' })
      .expect(500);
    let persisted = await models.Client.findByPk(client.id);
    expect(persisted.name).toBe(client.name);

    await deleteClient(client.id, 'Must roll back.').expect(500);
    persisted = await models.Client.findByPk(client.id);
    expect(persisted.deletedAt).toBeNull();

    await persisted.update({
      deletedAt: new Date(),
      deletedByUserId: admin.id,
      deleteReason: 'Direct fixture.',
    });
    await adminRequest(app)
      .post(`/api/clients/${client.id}/restore`)
      .send({ reason: 'Must roll back.' })
      .expect(500);
    persisted = await models.Client.findByPk(client.id);
    expect(persisted.deletedAt).not.toBeNull();
    expect(persisted.deleteReason).toBe('Direct fixture.');
  });

  it('serializes concurrent delete versus bike creation without invalid lifecycle', async () => {
    const client = await createClient();
    const [deleteResponse, bikeResponse] = await Promise.all([
      deleteClient(client.id, 'Concurrent delete.'),
      adminRequest(app).post('/api/bikes').send({
        plate: 'RAC001',
        brand: 'Honda',
        model: 'XR',
        clientId: client.id,
      }),
    ]);
    expect([200, 409]).toContain(deleteResponse.status);
    expect([201, 409]).toContain(bikeResponse.status);
    expect([deleteResponse.status, bikeResponse.status].filter((status) =>
      status < 300)).toHaveLength(1);

    const persistedClient = await models.Client.findByPk(client.id);
    const activeBikeCount = await models.Bike.count({
      where: { clientId: client.id, deletedAt: null },
    });
    expect(persistedClient.deletedAt !== null && activeBikeCount > 0).toBe(false);
  });
});
