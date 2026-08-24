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
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS,
} from '../src/constants/workOrder.js';
import { workOrderRepository } from '../src/repositories/workOrderRepository.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  createAuthenticatedRequest,
  createTestIdentity,
} from './helpers/authenticatedRequest.js';

let migrator;
let adminAccessToken;
const request = createAuthenticatedRequest(() => adminAccessToken);

const EXPECTED_TRANSITIONS = Object.freeze({
  [WORK_ORDER_STATUS.RECEIVED]: [
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.CANCELLED,
  ],
  [WORK_ORDER_STATUS.DIAGNOSIS]: [
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.CANCELLED,
  ],
  [WORK_ORDER_STATUS.IN_PROGRESS]: [
    WORK_ORDER_STATUS.READY,
    WORK_ORDER_STATUS.CANCELLED,
  ],
  [WORK_ORDER_STATUS.READY]: [
    WORK_ORDER_STATUS.DELIVERED,
    WORK_ORDER_STATUS.CANCELLED,
  ],
  [WORK_ORDER_STATUS.DELIVERED]: [],
  [WORK_ORDER_STATUS.CANCELLED]: [],
});

const cleanDomainData = async () => {
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
};

const createBike = async () => {
  const client = await models.Client.create({
    name: 'State Machine Client',
    phone: '3009876543',
    email: 'state-machine@example.com',
  });
  const bike = await models.Bike.create({
    plate: 'STM001',
    brand: 'Honda',
    model: 'CB 190R',
    cylinder: '184',
    clientId: client.id,
  });
  return { client, bike };
};

const createWorkOrder = (bikeId, overrides = {}) =>
  models.WorkOrder.create({
    bikeId,
    entryDate: new Date('2026-08-24T15:00:00.000Z'),
    faultDescription: 'State-machine verification.',
    ...overrides,
  });

const updateStatus = (workOrderId, toStatus, note) => {
  const payload = { toStatus };
  if (note !== undefined) {
    payload.note = note;
  }

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
  ({ accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Status Admin',
    email: 'status-admin@example.test',
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

describe('Work Order Status API', () => {
  it('persists the complete forward path and leaves the total unchanged', async () => {
    const { bike } = await createBike();
    const createResponse = await request(app).post('/api/work-orders').send({
      bikeId: bike.id,
      entryDate: '2026-08-24T15:00:00.000Z',
      faultDescription: 'Complete forward workflow.',
    });
    const workOrderId = createResponse.body.data.id;
    const itemResponse = await request(app)
      .post(`/api/work-orders/${workOrderId}/items`)
      .send({
        type: WORK_ORDER_ITEM_TYPE.LABOR,
        description: 'Diagnosis',
        count: '1.00',
        unitValue: '75000.00',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe(WORK_ORDER_STATUS.RECEIVED);
    expect(itemResponse.status).toBe(201);

    const forwardPath = [
      WORK_ORDER_STATUS.DIAGNOSIS,
      WORK_ORDER_STATUS.IN_PROGRESS,
      WORK_ORDER_STATUS.READY,
      WORK_ORDER_STATUS.DELIVERED,
    ];

    for (const [index, toStatus] of forwardPath.entries()) {
      const response = await updateStatus(
        workOrderId,
        toStatus,
        index === 0 ? '  Initial diagnosis completed.  ' : null,
      );
      const persisted = await models.WorkOrder.findByPk(workOrderId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: { id: workOrderId, status: toStatus },
      });
      expect(response.body.data).not.toHaveProperty('note');
      expect(persisted.status).toBe(toStatus);
      expect(persisted.total).toBe('75000.00');
    }
  });

  it.each([
    WORK_ORDER_STATUS.RECEIVED,
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.READY,
  ])('allows cancellation from %s', async (fromStatus) => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id, { status: fromStatus });

    const response = await updateStatus(
      workOrder.id,
      WORK_ORDER_STATUS.CANCELLED,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: workOrder.id,
      status: WORK_ORDER_STATUS.CANCELLED,
    });
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.CANCELLED);
  });

  it('enforces the complete six-by-six transition matrix', async () => {
    const { bike } = await createBike();

    for (const fromStatus of WORK_ORDER_STATUSES) {
      for (const toStatus of WORK_ORDER_STATUSES) {
        const workOrder = await createWorkOrder(bike.id, { status: fromStatus });
        const response = await updateStatus(workOrder.id, toStatus);
        const isAllowed = EXPECTED_TRANSITIONS[fromStatus].includes(toStatus);

        await workOrder.reload();
        if (isAllowed) {
          expect(response.status, `${fromStatus} -> ${toStatus}`).toBe(200);
          expect(response.body.data.status).toBe(toStatus);
          expect(workOrder.status).toBe(toStatus);
        } else {
          expect(response.status, `${fromStatus} -> ${toStatus}`).toBe(400);
          expect(response.body.error).toEqual({
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition work order from ${fromStatus} to ${toStatus}.`,
          });
          expect(workOrder.status).toBe(fromStatus);
        }
      }
    }
  });

  it.each([
    [WORK_ORDER_STATUS.DELIVERED, WORK_ORDER_STATUS.CANCELLED],
    [WORK_ORDER_STATUS.CANCELLED, WORK_ORDER_STATUS.RECEIVED],
  ])('keeps terminal state %s immutable against %s', async (fromStatus, toStatus) => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id, { status: fromStatus });

    const response = await updateStatus(workOrder.id, toStatus);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    await workOrder.reload();
    expect(workOrder.status).toBe(fromStatus);
  });

  it('rejects a same-state transition with the stable business error', async () => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id, {
      status: WORK_ORDER_STATUS.IN_PROGRESS,
    });

    const response = await updateStatus(
      workOrder.id,
      WORK_ORDER_STATUS.IN_PROGRESS,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message:
          'Cannot transition work order from EN_PROCESO to EN_PROCESO.',
      },
    });
  });

  it.each(['REPARANDO', 'FINALIZADA', 'PENDIENTE'])(
    'rejects unknown target state %s during request validation',
    async (toStatus) => {
      const { bike } = await createBike();
      const workOrder = await createWorkOrder(bike.id);

      const response = await updateStatus(workOrder.id, toStatus);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual({
        field: 'toStatus',
        message: 'Target status must be a contractual work-order status.',
      });
      await workOrder.reload();
      expect(workOrder.status).toBe(WORK_ORDER_STATUS.RECEIVED);
    },
  );

  it.each([
    ['missing toStatus', {}, 'toStatus'],
    ['non-string note', { toStatus: WORK_ORDER_STATUS.DIAGNOSIS, note: 123 }, 'note'],
    [
      'oversized note',
      { toStatus: WORK_ORDER_STATUS.DIAGNOSIS, note: 'n'.repeat(1001) },
      'note',
    ],
  ])('rejects %s', async (_case, payload, field) => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id);

    const response = await request(app)
      .patch(`/api/work-orders/${workOrder.id}/status`)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field }),
    );
  });

  it('returns 404 for a missing work order', async () => {
    const response = await updateStatus(
      999999,
      WORK_ORDER_STATUS.DIAGNOSIS,
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'WORK_ORDER_NOT_FOUND',
        message: 'Work order not found.',
      },
    });
  });

  it('rejects a malformed work-order id before opening a transaction', async () => {
    const response = await request(app)
      .patch('/api/work-orders/not-an-id/status')
      .send({ toStatus: WORK_ORDER_STATUS.DIAGNOSIS });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'id' }),
    );
  });

  it('rolls back cleanly when status persistence fails', async () => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id);
    vi.spyOn(workOrderRepository, 'updateStatus').mockRejectedValueOnce(
      new Error('simulated status persistence failure'),
    );

    const response = await updateStatus(
      workOrder.id,
      WORK_ORDER_STATUS.DIAGNOSIS,
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('simulated');
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.RECEIVED);
  });

  it('serializes a concurrently valid diagnosis/cancellation sequence', async () => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id);

    const [diagnosisResponse, cancellationResponse] = await Promise.all([
      updateStatus(workOrder.id, WORK_ORDER_STATUS.DIAGNOSIS),
      updateStatus(workOrder.id, WORK_ORDER_STATUS.CANCELLED),
    ]);

    expect(cancellationResponse.status).toBe(200);
    expect([200, 400]).toContain(diagnosisResponse.status);
    if (diagnosisResponse.status === 400) {
      expect(diagnosisResponse.body.error).toEqual({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot transition work order from CANCELADA to DIAGNOSTICO.',
      });
    }
    await workOrder.reload();
    expect(workOrder.status).toBe(WORK_ORDER_STATUS.CANCELLED);
  });

  it('allows exactly one competing terminal transition after revalidation under lock', async () => {
    const { bike } = await createBike();
    const workOrder = await createWorkOrder(bike.id, {
      status: WORK_ORDER_STATUS.READY,
    });
    const sqlStatements = [];
    const previousLogging = sequelize.options.logging;
    sequelize.options.logging = (statement) => sqlStatements.push(statement);

    let responses;
    try {
      responses = await Promise.all([
        updateStatus(workOrder.id, WORK_ORDER_STATUS.DELIVERED),
        updateStatus(workOrder.id, WORK_ORDER_STATUS.CANCELLED),
      ]);
    } finally {
      sequelize.options.logging = previousLogging;
    }

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 400]);
    await workOrder.reload();
    expect([
      WORK_ORDER_STATUS.DELIVERED,
      WORK_ORDER_STATUS.CANCELLED,
    ]).toContain(workOrder.status);

    const losingResponse = responses.find(({ status }) => status === 400);
    const losingTarget =
      workOrder.status === WORK_ORDER_STATUS.DELIVERED
        ? WORK_ORDER_STATUS.CANCELLED
        : WORK_ORDER_STATUS.DELIVERED;
    expect(losingResponse.body.error).toEqual({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Cannot transition work order from ${workOrder.status} to ${losingTarget}.`,
    });

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
  });
});
