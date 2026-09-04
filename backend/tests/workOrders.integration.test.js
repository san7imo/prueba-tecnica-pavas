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
import { env } from '../src/config/env.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import { workOrderRepository } from '../src/repositories/workOrderRepository.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let admin;
let adminAccessToken;
const request = createAuthenticatedRequest(() => adminAccessToken);

const cleanDomainData = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
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

const validItemPayload = (overrides = {}) => ({
  type: WORK_ORDER_ITEM_TYPE.LABOR,
  description: 'Workshop diagnosis',
  count: '1.00',
  unitValue: '50000.00',
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
  ({ user: admin, accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Work Orders Admin',
    email: 'work-orders-admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
});

beforeEach(async () => {
  await cleanDomainData();
});

afterEach(() => {
  vi.restoreAllMocks();
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
        assignedMechanicId: null,
        assignedMechanic: null,
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

    it('rejects a second open order for the same motorcycle with a stable conflict', async () => {
      const { bike } = await createBike();
      const first = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id));
      const second = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id, { faultDescription: 'A second fault.' }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body.error).toEqual({
        code: 'BIKE_HAS_ACTIVE_WORK_ORDER',
        message: 'Motorcycle already has an open work order.',
      });
      expect(await models.WorkOrder.count({ where: { bikeId: bike.id } })).toBe(1);
    });

    it('allows a new order after the previous order is closed', async () => {
      const { bike } = await createBike();
      const first = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id));
      const firstId = first.body.data.id;

      for (const toStatus of [
        WORK_ORDER_STATUS.DIAGNOSIS,
        WORK_ORDER_STATUS.IN_PROGRESS,
        WORK_ORDER_STATUS.READY,
        WORK_ORDER_STATUS.DELIVERED,
      ]) {
        await request(app)
          .patch(`/api/work-orders/${firstId}/status`)
          .send({ toStatus })
          .expect(200);
      }

      const second = await request(app)
        .post('/api/work-orders')
        .send(validPayload(bike.id, { faultDescription: 'Unrelated later fault.' }));
      expect(second.status).toBe(201);
      expect(second.body.data.id).not.toBe(firstId);
      expect(await models.WorkOrder.count({ where: { bikeId: bike.id } })).toBe(2);
    });

    it('serializes concurrent creates so exactly one order commits', async () => {
      const { bike } = await createBike();
      const responses = await Promise.all([
        request(app).post('/api/work-orders').send(
          validPayload(bike.id, { faultDescription: 'Concurrent request A.' }),
        ),
        request(app).post('/api/work-orders').send(
          validPayload(bike.id, { faultDescription: 'Concurrent request B.' }),
        ),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(responses.find(({ status }) => status === 409).body.error.code)
        .toBe('BIKE_HAS_ACTIVE_WORK_ORDER');
      expect(await models.WorkOrder.count({ where: { bikeId: bike.id } })).toBe(1);
      expect(await models.WorkOrderStatusHistory.count()).toBe(1);
      expect(await models.AuditEvent.count()).toBe(1);
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
      const client = await createClient();
      const { bike: receivedBike } = await createBike({ client, plate: 'REC001' });
      const { bike: diagnosisBike } = await createBike({ client, plate: 'DIA001' });
      await createWorkOrder(receivedBike.id, { status: WORK_ORDER_STATUS.RECEIVED });
      await createWorkOrder(diagnosisBike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });

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
    ])('filters by %s normalized exact plate', async (_case, plate) => {
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

    it('does not treat an incomplete plate as a substring search', async () => {
      const { bike } = await createBike({ plate: 'ABC123' });
      await createWorkOrder(bike.id);

      const response = await request(app)
        .get('/api/work-orders')
        .query({ plate: 'BC1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.totalItems).toBe(0);
    });

    it('combines status and plate filters', async () => {
      const client = await createClient();
      const { bike: matchingBike } = await createBike({ client, plate: 'ABC123' });
      const { bike: otherBike } = await createBike({ client, plate: 'XYZ987' });
      await createWorkOrder(matchingBike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });
      await createWorkOrder(matchingBike.id, { status: WORK_ORDER_STATUS.DELIVERED });
      await createWorkOrder(otherBike.id, { status: WORK_ORDER_STATUS.DIAGNOSIS });

      const response = await request(app).get('/api/work-orders').query({
        status: WORK_ORDER_STATUS.DIAGNOSIS,
        plate: 'abc123',
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
          status: WORK_ORDER_STATUS.DELIVERED,
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
        status: WORK_ORDER_STATUS.DELIVERED,
      });
      const tiedFirst = await createWorkOrder(bike.id, {
        entryDate: new Date('2026-08-02T15:00:00.000Z'),
        status: WORK_ORDER_STATUS.DELIVERED,
      });
      const tiedSecond = await createWorkOrder(bike.id, {
        entryDate: new Date('2026-08-02T15:00:00.000Z'),
        status: WORK_ORDER_STATUS.DELIVERED,
      });

      const response = await request(app).get('/api/work-orders');

      expect(response.status).toBe(200);
      expect(response.body.data.map(({ id }) => id)).toEqual([
        tiedSecond.id,
        tiedFirst.id,
        older.id,
      ]);
    });

    it('uses one auth plus two count/list queries without N+1 reads', async () => {
      const { bike } = await createBike();
      await Promise.all([
        createWorkOrder(bike.id, { status: WORK_ORDER_STATUS.DELIVERED }),
        createWorkOrder(bike.id, { status: WORK_ORDER_STATUS.DELIVERED }),
        createWorkOrder(bike.id, { status: WORK_ORDER_STATUS.DELIVERED }),
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

      expect(queryCount).toBe(3);
    });

    it('uses equality for plate and keeps the count query free of unrelated joins', async () => {
      const { bike } = await createBike();
      await createWorkOrder(bike.id);
      const statements = [];
      const originalLogging = sequelize.options.logging;
      sequelize.options.logging = (sql) => statements.push(sql);

      try {
        await request(app).get('/api/work-orders').expect(200);
        await request(app)
          .get('/api/work-orders')
          .query({ plate: 'abc123' })
          .expect(200);
      } finally {
        sequelize.options.logging = originalLogging;
      }

      const workOrderStatements = statements.filter((sql) =>
        /FROM `work_orders`/i.test(sql));
      expect(workOrderStatements).toHaveLength(4);
      expect(workOrderStatements.every((sql) => !/\bLIKE\b/i.test(sql))).toBe(true);
      expect(workOrderStatements.some((sql) =>
        /`bike`\.`plate`\s*=\s*'ABC123'/i.test(sql))).toBe(true);

      const unfilteredCount = workOrderStatements.find((sql) =>
        /count\(/i.test(sql) && !/JOIN/i.test(sql));
      expect(unfilteredCount).toBeDefined();
    });
  });

  describe('GET /api/work-orders/:id', () => {
    it('returns the order with its bike, client, persisted total and items', async () => {
      const { bike, client } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      const itemResponse = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ description: 'Diagnosis' }));
      const item = itemResponse.body.data.item;

      const response = await request(app).get(`/api/work-orders/${workOrder.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: workOrder.id,
        bikeId: bike.id,
        status: WORK_ORDER_STATUS.RECEIVED,
        total: '50000.00',
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
            createdByUserId: admin.id,
            createdBy: { id: admin.id, name: 'Work Orders Admin' },
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

  describe('POST /api/work-orders/:id/items', () => {
    it('creates both item types and recalculates the authoritative total', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const laborResponse = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ count: '2.00', unitValue: '50000.00' }));
      const partResponse = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(
          validItemPayload({
            type: WORK_ORDER_ITEM_TYPE.PART,
            description: 'Oil filter',
            count: '1.00',
            unitValue: '30000.00',
          }),
        );

      expect(laborResponse.status).toBe(201);
      expect(laborResponse.body.data).toEqual({
        item: {
          id: expect.any(Number),
          type: WORK_ORDER_ITEM_TYPE.LABOR,
          description: 'Workshop diagnosis',
          count: '2.00',
          unitValue: '50000.00',
          createdByUserId: admin.id,
          createdBy: { id: admin.id, name: 'Work Orders Admin' },
        },
        workOrderTotal: '100000.00',
      });
      expect(laborResponse.body.data.item).not.toHaveProperty('workOrderId');
      expect(partResponse.status).toBe(201);
      expect(partResponse.body.data.item.type).toBe(WORK_ORDER_ITEM_TYPE.PART);
      expect(partResponse.body.data.workOrderTotal).toBe('130000.00');

      await workOrder.reload();
      expect(workOrder.total).toBe('130000.00');
      expect(
        await models.WorkOrderItem.count({ where: { workOrderId: workOrder.id } }),
      ).toBe(2);
    });

    it('supports fractional quantities and zero-value items exactly', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const fractionalResponse = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ count: 1.5, unitValue: '50000.00' }));
      const zeroResponse = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ unitValue: 0 }));

      expect(fractionalResponse.status).toBe(201);
      expect(fractionalResponse.body.data.item.count).toBe('1.50');
      expect(fractionalResponse.body.data.workOrderTotal).toBe('75000.00');
      expect(zeroResponse.status).toBe(201);
      expect(zeroResponse.body.data.item.unitValue).toBe('0.00');
      expect(zeroResponse.body.data.workOrderTotal).toBe('75000.00');
    });

    it('preserves exact decimal addition for 0.10 plus 0.20', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ unitValue: '0.10' }));
      const response = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ unitValue: '0.20' }));

      expect(response.status).toBe(201);
      expect(response.body.data.workOrderTotal).toBe('0.30');
      await workOrder.reload();
      expect(workOrder.total).toBe('0.30');
    });

    it.each([
      ['count', { count: 0 }],
      ['count', { count: '-1.00' }],
      ['count', { count: '1.001' }],
      ['count', { count: '100000000.00' }],
      ['unitValue', { unitValue: '-0.01' }],
      ['unitValue', { unitValue: '1.001' }],
      ['unitValue', { unitValue: '10000000000000.00' }],
      ['type', { type: 'SERVICIO' }],
      ['description', { description: '   ' }],
    ])('rejects invalid %s input', async (field, overrides) => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const response = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload(overrides));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
      });
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field }),
      );
      expect(await models.WorkOrderItem.count()).toBe(0);
    });

    it.each(['count', 'unitValue', 'type', 'description'])(
      'rejects missing %s input',
      async (field) => {
        const { bike } = await createBike();
        const workOrder = await createWorkOrder(bike.id);
        const payload = validItemPayload();
        delete payload[field];

        const response = await request(app)
          .post(`/api/work-orders/${workOrder.id}/items`)
          .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field }),
        );
      },
    );

    it('returns 404 and creates nothing when the work order does not exist', async () => {
      const response = await request(app)
        .post('/api/work-orders/999999/items')
        .send(validItemPayload());

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'WORK_ORDER_NOT_FOUND',
          message: 'Work order not found.',
        },
      });
      expect(await models.WorkOrderItem.count()).toBe(0);
    });

    it('rejects a malformed work-order id before opening a transaction', async () => {
      const response = await request(app)
        .post('/api/work-orders/not-an-id/items')
        .send(validItemPayload());

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'id' }),
      );
      expect(await models.WorkOrderItem.count()).toBe(0);
    });

    it('ignores internal item and total fields through explicit whitelists', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const response = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send({
          ...validItemPayload(),
          id: 700,
          workOrderId: 999999,
          workOrderTotal: '999999.00',
          createdAt: '2000-01-01T00:00:00.000Z',
          createdByUserId: 999999,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.item.id).not.toBe(700);
      expect(response.body.data.item).not.toHaveProperty('workOrderId');
      expect(response.body.data.item.createdByUserId).toBe(admin.id);
      expect(response.body.data.workOrderTotal).toBe('50000.00');
      expect(
        await models.WorkOrderItem.count({ where: { workOrderId: workOrder.id } }),
      ).toBe(1);
    });

    it('rolls back the inserted item when total persistence fails', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      vi.spyOn(workOrderRepository, 'updateTotal').mockRejectedValueOnce(
        new Error('simulated downstream persistence failure'),
      );

      const response = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload());

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      expect(JSON.stringify(response.body)).not.toContain('simulated');
      expect(await models.WorkOrderItem.count()).toBe(0);
      await workOrder.reload();
      expect(workOrder.total).toBe('0.00');
    });

    it('serializes concurrent additions with independent transactions and a row lock', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      const sqlStatements = [];
      const previousLogging = sequelize.options.logging;
      sequelize.options.logging = (statement) => sqlStatements.push(statement);

      let responses;
      try {
        responses = await Promise.all([
          request(app)
            .post(`/api/work-orders/${workOrder.id}/items`)
            .send(validItemPayload({ count: '1.00', unitValue: '100.00' })),
          request(app)
            .post(`/api/work-orders/${workOrder.id}/items`)
            .send(validItemPayload({ count: '2.00', unitValue: '50.00' })),
        ]);
      } finally {
        sequelize.options.logging = previousLogging;
      }

      expect(responses.map(({ status }) => status)).toEqual([201, 201]);
      expect(
        responses.map(({ body }) => body.data.workOrderTotal).sort(),
      ).toEqual(['100.00', '200.00']);
      expect(
        sqlStatements.filter((statement) => /START TRANSACTION/i.test(statement)),
      ).toHaveLength(2);
      const lockingQueries = sqlStatements.filter((statement) =>
        /FROM `work_orders`.*FOR UPDATE/i.test(statement),
      );
      expect(lockingQueries).toHaveLength(2);
      const transactionIds = lockingQueries
        .map((statement) => /Executing \(([^)]+)\)/.exec(statement)?.[1])
        .filter(Boolean);
      expect(new Set(transactionIds).size).toBe(2);

      await workOrder.reload();
      expect(workOrder.total).toBe('200.00');
      expect(
        await models.WorkOrderItem.count({ where: { workOrderId: workOrder.id } }),
      ).toBe(2);
    });
  });

  describe('DELETE /api/work-orders/items/:itemId', () => {
    it('deletes items and recalculates the total down to exact zero', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      const first = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ count: '2.00', unitValue: '50000.00' }));
      const second = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(
          validItemPayload({
            type: WORK_ORDER_ITEM_TYPE.PART,
            unitValue: '30000.00',
          }),
        );

      const firstDelete = await request(app).delete(
        `/api/work-orders/items/${first.body.data.item.id}`,
      );
      const detailAfterFirstDelete = await request(app).get(
        `/api/work-orders/${workOrder.id}`,
      );
      const secondDelete = await request(app).delete(
        `/api/work-orders/items/${second.body.data.item.id}`,
      );

      expect(firstDelete.status).toBe(200);
      expect(firstDelete.body).toEqual({
        data: {
          deletedItemId: first.body.data.item.id,
          workOrderTotal: '30000.00',
        },
      });
      expect(detailAfterFirstDelete.body.data.total).toBe('30000.00');
      expect(detailAfterFirstDelete.body.data.items).toHaveLength(1);
      expect(secondDelete.status).toBe(200);
      expect(secondDelete.body.data).toEqual({
        deletedItemId: second.body.data.item.id,
        workOrderTotal: '0.00',
      });

      await workOrder.reload();
      expect(workOrder.total).toBe('0.00');
      expect(await models.WorkOrderItem.count()).toBe(0);
    });

    it('returns 404 for a missing item without changing the order total', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const response = await request(app).delete(
        '/api/work-orders/items/999999',
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'WORK_ORDER_ITEM_NOT_FOUND',
          message: 'Work-order item not found.',
        },
      });
      await workOrder.reload();
      expect(workOrder.total).toBe('0.00');
    });

    it('rejects an invalid item id', async () => {
      const response = await request(app).delete(
        '/api/work-orders/items/not-an-id',
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'itemId' }),
      );
    });

    it('keeps create/delete races consistent under the same work-order lock', async () => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);
      const existing = await request(app)
        .post(`/api/work-orders/${workOrder.id}/items`)
        .send(validItemPayload({ unitValue: '100.00' }));

      const [createResponse, deleteResponse] = await Promise.all([
        request(app)
          .post(`/api/work-orders/${workOrder.id}/items`)
          .send(validItemPayload({ count: '2.00', unitValue: '50.00' })),
        request(app).delete(
          `/api/work-orders/items/${existing.body.data.item.id}`,
        ),
      ]);

      expect(createResponse.status).toBe(201);
      expect(deleteResponse.status).toBe(200);
      await workOrder.reload();
      expect(workOrder.total).toBe('100.00');
      const remainingItems = await models.WorkOrderItem.findAll({
        where: { workOrderId: workOrder.id },
      });
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0].id).toBe(createResponse.body.data.item.id);
    });
  });
});
