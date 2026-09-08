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
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let adminAccessToken;
let clientDocumentSequence = 0;
const request = createAuthenticatedRequest(() => adminAccessToken);

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const clientPayload = (overrides = {}) => ({
  documentNumber: String(1000000000 + ++clientDocumentSequence),
  name: 'Juan Perez',
  phone: '3001234567',
  email: 'juan@example.com',
  ...overrides,
});

const createClient = async (overrides = {}) => {
  const response = await request(app).post('/api/clients').send(clientPayload(overrides));
  expect(response.status).toBe(201);
  return response.body.data;
};

const bikePayload = (clientId, overrides = {}) => ({
  plate: 'abc 123',
  brand: 'Yamaha',
  model: 'FZ 2.0',
  cylinder: 149,
  clientId,
  ...overrides,
});

const createBike = async (clientId, overrides = {}) => {
  const response = await request(app)
    .post('/api/bikes')
    .send(bikePayload(clientId, overrides));
  expect(response.status).toBe(201);
  return response.body.data;
};

const clientCore = ({ id, documentNumber, name, phone, email }) => ({
  id,
  documentNumber,
  name,
  phone,
  email,
});

const activeClientShape = (client) => ({
  ...clientCore(client),
  lifecycle: 'active',
  deletedAt: null,
  deletedByUserId: null,
  deleteReason: null,
});

const activeBikeShape = (bike) => ({
  ...bike,
  client: activeClientShape(bike.client),
  lifecycle: 'active',
  deletedAt: null,
  deletedByUserId: null,
  deleteReason: null,
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
  ({ accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Clients Bikes Admin',
    email: 'clients-bikes-admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
});

beforeEach(async () => {
  clientDocumentSequence = 0;
  await cleanDomainData();
});

afterAll(async () => {
  if (migrator) {
    await migrator.down({ to: 0 });
  }
  await sequelize.close();
});

describe('Clients API', () => {
  describe('POST /api/clients', () => {
    it('creates a client and returns only public fields', async () => {
      const response = await request(app).post('/api/clients').send({
        ...clientPayload(),
        id: 999999,
        createdAt: '2020-01-01T00:00:00.000Z',
        internalFlag: true,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        data: activeClientShape({
          id: expect.any(Number),
          documentNumber: expect.any(String),
          name: 'Juan Perez',
          phone: '3001234567',
          email: 'juan@example.com',
        }),
      });
      expect(response.body.data.id).not.toBe(999999);
    });

    it('accepts an omitted email and persists null', async () => {
      const payload = clientPayload();
      delete payload.email;

      const response = await request(app).post('/api/clients').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBeNull();
    });

    it.each([
      ['documentNumber', { name: 'Juan Perez', phone: '3001234567' }],
      ['name', { phone: '3001234567' }],
      ['phone', { name: 'Juan Perez' }],
    ])('rejects a missing %s', async (field, payload) => {
      const response = await request(app).post('/api/clients').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
      });
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field }),
      );
    });

    it('rejects an invalid email', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send(clientPayload({ email: 'not-an-email' }));

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual({
        field: 'email',
        message: 'Email must be valid.',
      });
    });

    it('trims text fields and lowercases email', async () => {
      const response = await request(app).post('/api/clients').send(
        clientPayload({
          name: '  Juan Perez  ',
          phone: '  3001234567  ',
          email: '  JUAN@EXAMPLE.COM  ',
        }),
      );

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        name: 'Juan Perez',
        phone: '3001234567',
        email: 'juan@example.com',
      });
    });
  });

  describe('GET /api/clients', () => {
    beforeEach(async () => {
      await createClient({
        name: 'Ana Torres',
        phone: '3112223344',
        email: 'ana.torres@example.com',
      });
      await createClient({
        name: 'Carlos Gomez',
        phone: '3009876543',
        email: 'carlos@workshop.test',
      });
    });

    it('lists clients without a search term', async () => {
      const response = await request(app).get('/api/clients');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      });
      expect(response.body.data.map(({ name }) => name)).toEqual([
        'Ana Torres',
        'Carlos Gomez',
      ]);
    });

    it.each([
      ['name', 'torres', 'Ana Torres'],
      ['phone', '9876', 'Carlos Gomez'],
      ['email', 'WORKSHOP.TEST', 'Carlos Gomez'],
    ])('searches partially by %s', async (_field, search, expectedName) => {
      const response = await request(app)
        .get('/api/clients')
        .query({ search });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe(expectedName);
    });

    it('returns an empty list when search has no match', async () => {
      const response = await request(app)
        .get('/api/clients')
        .query({ search: 'no-match' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
    });
  });

  describe('GET /api/clients/:id', () => {
    it('returns an existing client', async () => {
      const client = await createClient();
      const response = await request(app).get(`/api/clients/${client.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: client });
    });

    it('returns 404 for a missing client', async () => {
      const response = await request(app).get('/api/clients/999999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' },
      });
    });

    it('rejects a clearly invalid client id before persistence', async () => {
      const response = await request(app).get('/api/clients/not-an-id');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Bikes API', () => {
  describe('POST /api/bikes', () => {
    it('creates a normalized bike with its client and public fields only', async () => {
      const client = await createClient();
      const response = await request(app).post('/api/bikes').send({
        ...bikePayload(client.id, { plate: '  abc 123  ' }),
        id: 999999,
        createdAt: '2020-01-01T00:00:00.000Z',
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({
        id: expect.any(Number),
        plate: 'ABC123',
        brand: 'Yamaha',
        model: 'FZ 2.0',
        cylinder: '149',
        clientId: client.id,
        client: activeClientShape(client),
        lifecycle: 'active',
        deletedAt: null,
        deletedByUserId: null,
        deleteReason: null,
      });
      expect(response.body.data.id).not.toBe(999999);
    });

    it('accepts an omitted cylinder and persists null', async () => {
      const client = await createClient();
      const payload = bikePayload(client.id);
      delete payload.cylinder;

      const response = await request(app).post('/api/bikes').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.data.cylinder).toBeNull();
    });

    it.each([
      ['exact plate', 'ABC123'],
      ['different case', 'aBc123'],
      ['different spaces', ' a b c 1 2 3 '],
    ])('rejects a duplicate %s with 409', async (_case, duplicatePlate) => {
      const client = await createClient();
      await createBike(client.id, { plate: 'ABC123' });

      const response = await request(app)
        .post('/api/bikes')
        .send(bikePayload(client.id, { plate: duplicatePlate }));

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: {
          code: 'BIKE_PLATE_ALREADY_EXISTS',
          message: 'A bike with this plate already exists.',
        },
      });
    });

    it('rejects a missing client relation without exposing a foreign-key error', async () => {
      const response = await request(app)
        .post('/api/bikes')
        .send(bikePayload(999999));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found.' },
      });
    });

    it.each(['plate', 'brand', 'model', 'clientId'])(
      'rejects a missing %s',
      async (field) => {
        const client = await createClient();
        const payload = bikePayload(client.id);
        delete payload[field];

        const response = await request(app).post('/api/bikes').send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field }),
        );
      },
    );
  });

  describe('GET /api/bikes', () => {
    beforeEach(async () => {
      const client = await createClient();
      await createBike(client.id, { plate: 'ABC123' });
      await createBike(client.id, { plate: 'XYZ987', model: 'MT-03' });
    });

    it('lists bikes without a plate filter', async () => {
      const response = await request(app).get('/api/bikes');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      });
      expect(response.body.data.every(({ client }) => client.name === 'Juan Perez')).toBe(true);
    });

    it.each([
      ['exact normalized plate', { plate: 'ABC123' }, 'ABC123'],
      ['lowercase exact plate', { plate: 'xyz987' }, 'XYZ987'],
      ['normalized prefix', { platePrefix: 'abc' }, 'ABC123'],
      ['spaced exact plate', { plate: ' a b c 1 2 3 ' }, 'ABC123'],
    ])('searches by %s', async (_case, query, expectedPlate) => {
      const response = await request(app).get('/api/bikes').query(query);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].plate).toBe(expectedPlate);
    });

    it('returns an empty list when plate has no match', async () => {
      const response = await request(app)
        .get('/api/bikes')
        .query({ plate: 'NOPE' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
    });
  });

  describe('GET /api/bikes/:id', () => {
    it('returns an existing bike including its client', async () => {
      const client = await createClient();
      const bike = await createBike(client.id);
      const response = await request(app).get(`/api/bikes/${bike.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        ...activeBikeShape(bike),
        currentOpenOrder: null,
      });
      expect(response.body.data.client).toEqual(activeClientShape(client));
    });

    it('returns 404 for a missing bike', async () => {
      const response = await request(app).get('/api/bikes/999999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'BIKE_NOT_FOUND', message: 'Bike not found.' },
      });
    });

    it('rejects a clearly invalid bike id before persistence', async () => {
      const response = await request(app).get('/api/bikes/not-an-id');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
