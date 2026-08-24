import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';

let migrator;

const cleanDomainData = async () => {
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createClient = (overrides = {}) =>
  models.Client.create({
    name: 'Ana Torres',
    phone: '3001234567',
    email: 'ana@example.com',
    ...overrides,
  });

const createBike = async (overrides = {}) => {
  const client = overrides.client ?? (await createClient());
  const bike = await models.Bike.create({
    plate: 'ABC123',
    brand: 'Yamaha',
    model: 'FZ 2.0',
    cylinder: '149',
    clientId: client.id,
    ...overrides,
    client: undefined,
  });
  return { client, bike };
};

const createWorkOrder = (bikeId, overrides = {}) =>
  models.WorkOrder.create({
    bikeId,
    entryDate: new Date('2026-08-24T15:00:00.000Z'),
    faultDescription: 'Abnormal transmission noise.',
    ...overrides,
  });

const validPayload = (bikeId, overrides = {}) => ({
  bikeId,
  entryDate: '2026-08-24T15:00:00.000Z',
  faultDescription: 'Abnormal transmission noise.',
  ...overrides,
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
});

beforeEach(async () => {
  await cleanDomainData();
});

afterAll(async () => {
  if (migrator) {
    await migrator.down({ to: 0 });
  }
  await sequelize.close();
});

describe('Work Orders API', () => {
  describe('POST /api/work-orders', () => {
    it('creates a RECIBIDA order with zero total for a valid bike and date', async () => {
      const { bike, client } = await createBike();
      const response = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id));

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({
        id: expect.any(Number),
        bikeId: bike.id,
        entryDate: '2026-08-24T15:00:00.000Z',
        faultDescription: 'Abnormal transmission noise.',
        status: WORK_ORDER_STATUS.RECEIVED,
        total: '0.00',
        bike: {
          id: bike.id,
          plate: 'ABC123',
          brand: 'Yamaha',
          model: 'FZ 2.0',
          cylinder: '149',
          clientId: client.id,
          client: {
            id: client.id,
            name: 'Ana Torres',
            phone: '3001234567',
            email: 'ana@example.com',
          },
        },
        items: [],
      });
    });

    it('returns 404 when the bike does not exist', async () => {
      const response = await request(app)
        .post('/api/work-orders')
        .send(validPayload(999999));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'BIKE_NOT_FOUND', message: 'Bike not found.' },
      });
    });

    it.each([
      ['bikeId', { faultDescription: 'Failure.' }],
      ['faultDescription', { bikeId: 1 }],
    ])('rejects a missing %s', async (field, payload) => {
      const response = await request(app).post('/api/work-orders').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field }),
      );
    });

    it.each([
      ['not-a-date'],
      ['2026-08-24'],
      ['2026-02-30T15:00:00.000Z'],
    ])('rejects invalid or ambiguous entry date %s', async (entryDate) => {
      const { bike } = await createBike();
      const response = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id, { entryDate }));

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'entryDate' }),
      );
    });

    it('uses the current server time when entryDate is omitted', async () => {
      const { bike } = await createBike();
      const beforeRequest = Date.now();
      const payload = validPayload(bike.id);
      delete payload.entryDate;

      const response = await request(app).post('/api/work-orders').send(payload);
      const afterRequest = Date.now();
      const persistedTime = Date.parse(response.body.data.entryDate);

      expect(response.status).toBe(201);
      expect(persistedTime).toBeGreaterThanOrEqual(beforeRequest - 1000);
      expect(persistedTime).toBeLessThanOrEqual(afterRequest + 1000);
    });

    it('ignores internal fields through explicit whitelists', async () => {
      const { bike } = await createBike();
      const response = await request(app)
        .post('/api/work-orders')
        .send({
          ...validPayload(bike.id),
          id: 900,
          status: WORK_ORDER_STATUS.DELIVERED,
          total: '999999999.00',
          createdAt: '2000-01-01T00:00:00.000Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).not.toBe(900);
      expect(response.body.data.status).toBe(WORK_ORDER_STATUS.RECEIVED);
      expect(response.body.data.total).toBe('0.00');
      expect(response.body.data).not.toHaveProperty('createdAt');
    });
  });

  describe('GET /api/work-orders', () => {
    it('returns an empty first page with correct default metadata', async () => {
      const response = await request(app).get('/api/work-orders');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
    });

    it('lists orders with bike and client data without items', async () => {
      const { bike } = await createBike();
      await createWorkOrder(bike.id);

      const response = await request(app).get('/api/work-orders');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].bike.plate).toBe('ABC123');
      expect(response.body.data[0].bike.client.name).toBe('Ana Torres');
      expect(response.body.data[0]).not.toHaveProperty('items');
    });

    it.each([
      [WORK_ORDER_STATUS.RECEIVED],
      [WORK_ORDER_STATUS.DIAGNOSIS],
    ])('filters by contractual status %s', async (status) => {
      const { bike } = await createBike();
      await createWorkOrder(bike.id, { status: WORK_ORDER_STATUS.RECEIVED });
      await createWorkOrder(bike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });

      const response = await request(app)
        .get('/api/work-orders')
        .query({ status });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(status);
    });

    it.each(['UNKNOWN', 'recibida'])(
      'rejects non-contractual status %s',
      async (status) => {
        const response = await request(app)
          .get('/api/work-orders')
          .query({ status });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field: 'status' }),
        );
      },
    );

    it.each([
      ['exact', 'ABC123'],
      ['lowercase', 'abc123'],
      ['spaces', 'a b c 1 2 3'],
      ['partial', 'BC1'],
    ])('filters by %s normalized plate', async (_case, plate) => {
      const client = await createClient();
      const { bike: matchingBike } = await createBike({ client, plate: 'ABC123' });
      const { bike: otherBike } = await createBike({ client, plate: 'XYZ987' });
      await createWorkOrder(matchingBike.id);
      await createWorkOrder(otherBike.id);

      const response = await request(app)
        .get('/api/work-orders')
        .query({ plate });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].bike.plate).toBe('ABC123');
    });

    it('combines status and plate filters', async () => {
      const client = await createClient();
      const { bike: matchingBike } = await createBike({ client, plate: 'ABC123' });
      const { bike: otherBike } = await createBike({ client, plate: 'XYZ987' });
      await createWorkOrder(matchingBike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });
      await createWorkOrder(matchingBike.id, { status: WORK_ORDER_STATUS.RECEIVED });
      await createWorkOrder(otherBike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });

      const response = await request(app).get('/api/work-orders').query({
        status: WORK_ORDER_STATUS.DIAGNOSIS,
        plate: 'abc',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        status: WORK_ORDER_STATUS.DIAGNOSIS,
        bike: { plate: 'ABC123' },
      });
    });

    it('applies page/pageSize and calculates totalItems and totalPages', async () => {
      const { bike } = await createBike();
      for (let day = 1; day <= 5; day += 1) {
        await createWorkOrder(bike.id, {
          entryDate: new Date(`2026-08-0${day}T15:00:00.000Z`),
        });
      }

      const response = await request(app)
        .get('/api/work-orders')
        .query({ page: 2, pageSize: 2 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        page: 2,
        pageSize: 2,
        totalItems: 5,
        totalPages: 3,
      });
      expect(response.body.data.map(({ entryDate }) => entryDate)).toEqual([
        '2026-08-03T15:00:00.000Z',
        '2026-08-02T15:00:00.000Z',
      ]);
    });

    it.each(['0', '-1', '1.5', 'abc'])(
      'rejects invalid page %s',
      async (page) => {
        const response = await request(app)
          .get('/api/work-orders')
          .query({ page });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field: 'page' }),
        );
      },
    );

    it.each(['0', '-1', '1.5', '101'])(
      'rejects invalid pageSize %s',
      async (pageSize) => {
        const response = await request(app)
          .get('/api/work-orders')
          .query({ pageSize });

        expect(response.status).toBe(400);
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field: 'pageSize' }),
        );
      },
    );

    it('orders deterministically by entryDate DESC then id DESC', async () => {
      const { bike } = await createBike();
      const older = await createWorkOrder(bike.id, {
        entryDate: new Date('2026-08-01T15:00:00.000Z'),
      });
      const tiedFirst = await createWorkOrder(bike.id, {
        entryDate: new Date('2026-08-02T15:00:00.000Z'),
      });
      const tiedSecond = await createWorkOrder(bike.id, {
        entryDate: new Date('2026-08-02T15:00:00.000Z'),
      });

      const response = await request(app).get('/api/work-orders');

      expect(response.status).toBe(200);
      expect(response.body.data.map(({ id }) => id)).toEqual([
        tiedSecond.id,
        tiedFirst.id,
        older.id,
      ]);
    });

    it('uses a constant two-query count/list strategy without N+1 reads', async () => {
      const { bike } = await createBike();
      await Promise.all([
        createWorkOrder(bike.id),
        createWorkOrder(bike.id),
        createWorkOrder(bike.id),
      ]);
      let queryCount = 0;
      const countQuery = () => {
        queryCount += 1;
      };
      sequelize.addHook('beforeQuery', 'workOrderListQueryCount', countQuery);

      try {
        const response = await request(app).get('/api/work-orders');
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(3);
      } finally {
        sequelize.removeHook('beforeQuery', 'workOrderListQueryCount');
      }

      expect(queryCount).toBe(2);
    });
  });

  describe('GET /api/work-orders/:id', () => {
    it('returns the order with its bike, client and existing items', async () => {
      const { bike, client } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      const item = await models.WorkOrderItem.create({
        workOrderId: workOrder.id,
        type: WORK_ORDER_ITEM_TYPE.LABOR,
        description: 'Diagnosis',
        count: '1.00',
        unitValue: '50000.00',
      });

      const response = await request(app).get(`/api/work-orders/${workOrder.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: workOrder.id,
        bikeId: bike.id,
        status: WORK_ORDER_STATUS.RECEIVED,
        total: '0.00',
        bike: {
          id: bike.id,
          plate: 'ABC123',
          client: {
            id: client.id,
            name: 'Ana Torres',
          },
        },
        items: [
          {
            id: item.id,
            type: WORK_ORDER_ITEM_TYPE.LABOR,
            description: 'Diagnosis',
            count: '1.00',
            unitValue: '50000.00',
          },
        ],
      });
    });

    it('returns 404 for a missing work order', async () => {
      const response = await request(app).get('/api/work-orders/999999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'WORK_ORDER_NOT_FOUND',
          message: 'Work order not found.',
        },
      });
    });

    it('rejects a clearly invalid work-order id', async () => {
      const response = await request(app).get('/api/work-orders/not-an-id');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
