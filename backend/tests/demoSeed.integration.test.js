import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_EXPECTED_COUNTS,
  DEMO_EXPECTED_STATUS_DISTRIBUTION,
  DEMO_MECHANIC_PASSWORD,
  seedDemoData,
} from '../seeders/seedDemoData.js';
import { seedInitialAdmin } from '../seeders/seedInitialAdmin.js';
import { env } from '../src/config/env.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { createMigrator } from '../src/config/migrator.js';
import { assertSafeTestDatabase } from '../src/config/testDatabaseGuard.js';
import { USER_ROLE } from '../src/constants/auth.js';
import { OPEN_WORK_ORDER_STATUSES, WORK_ORDER_STATUS } from '../src/constants/workOrder.js';
import { canTransition } from '../src/utils/workOrderStateMachine.js';

const ADMIN_CONFIGURATION = Object.freeze({
  name: 'Demo Seed Test Admin',
  email: 'demo.seed.admin@example.test',
  password: 'Demo-seed-admin-password-123',
});

const cleanDatabase = async () => {
  await models.AuditEvent.destroy({ where: {}, force: true });
  await models.WorkOrderStatusHistory.destroy({ where: {}, force: true });
  await models.WorkOrderItem.destroy({ where: {}, force: true });
  await models.WorkOrder.destroy({ where: {}, force: true });
  await models.Bike.destroy({ where: {}, force: true });
  await models.Client.destroy({ where: {}, force: true });
  await models.RefreshToken.destroy({ where: {}, force: true });
  await models.User.destroy({ where: {}, force: true });
};

const scaledInteger = (value, scale) => {
  const [whole, fraction = ''] = String(value).split('.');
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, '0').slice(0, scale))
  );
};

describe.sequential('optional demo data seed', () => {
  let migrator;

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
    await cleanDatabase();
    await seedInitialAdmin(ADMIN_CONFIGURATION);
  });

  afterAll(async () => {
    if (migrator) await migrator.down({ to: 0 });
    await sequelize.close();
  });

  it('refuses to run in production', async () => {
    await expect(seedDemoData({ nodeEnv: 'production' })).rejects.toThrow(
      'allowed only in development or test environments',
    );
    expect(await models.Client.count()).toBe(0);
  });

  it('requires an active ADMIN and leaves no partial demo data on failure', async () => {
    await models.User.destroy({ where: {}, force: true });

    await expect(seedDemoData()).rejects.toThrow('An active ADMIN is required');

    expect(await models.User.count()).toBe(0);
    expect(await models.Client.count()).toBe(0);
    expect(await models.Bike.count()).toBe(0);
    expect(await models.WorkOrder.count()).toBe(0);
  });

  it('creates the exact deterministic dataset with every canonical status', async () => {
    const result = await seedDemoData();
    const demoMechanics = await models.User.findAll({
      where: { email: { [Op.like]: `%@${DEMO_EMAIL_DOMAIN}` } },
      order: [['email', 'ASC']],
    });

    expect(result).toEqual({
      created: true,
      counts: DEMO_EXPECTED_COUNTS,
      statusDistribution: DEMO_EXPECTED_STATUS_DISTRIBUTION,
    });
    expect(await models.Client.count()).toBe(DEMO_EXPECTED_COUNTS.clients);
    expect(await models.Bike.count()).toBe(DEMO_EXPECTED_COUNTS.bikes);
    expect(await models.WorkOrder.count()).toBe(DEMO_EXPECTED_COUNTS.workOrders);
    expect(await models.WorkOrderItem.count()).toBe(DEMO_EXPECTED_COUNTS.items);
    expect(await models.WorkOrderStatusHistory.count()).toBe(DEMO_EXPECTED_COUNTS.history);
    expect(demoMechanics).toHaveLength(DEMO_EXPECTED_COUNTS.users);

    const demoClients = await models.Client.findAll({
      attributes: ['documentNumber'],
      order: [['id', 'ASC']],
    });
    expect(demoClients.every(({ documentNumber }) => documentNumber !== null))
      .toBe(true);
    expect(new Set(demoClients.map(({ documentNumber }) => documentNumber)).size)
      .toBe(DEMO_EXPECTED_COUNTS.clients);

    const openCounts = await models.WorkOrder.findAll({
      attributes: [
        'bikeId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'openCount'],
      ],
      where: { status: { [Op.in]: OPEN_WORK_ORDER_STATUSES } },
      group: ['bikeId'],
      raw: true,
    });
    expect(openCounts).toHaveLength(20);
    expect(openCounts.every(({ openCount }) => Number(openCount) === 1)).toBe(true);

    for (const mechanic of demoMechanics) {
      expect(mechanic.role).toBe(USER_ROLE.MECHANIC);
      expect(mechanic.active).toBe(true);
      expect(mechanic.passwordHash).toMatch(/^\$2[aby]\$/);
      await expect(
        bcrypt.compare(DEMO_MECHANIC_PASSWORD, mechanic.passwordHash),
      ).resolves.toBe(true);
    }
  });

  it('persists each total as the exact sum of its labor and part items', async () => {
    await seedDemoData();
    const orders = await models.WorkOrder.findAll({
      include: [{ model: models.WorkOrderItem, as: 'items' }],
    });

    expect(orders).toHaveLength(DEMO_EXPECTED_COUNTS.workOrders);
    for (const order of orders) {
      expect(order.items).toHaveLength(2);
      expect(new Set(order.items.map(({ type }) => type))).toEqual(
        new Set(['MANO_OBRA', 'REPUESTO']),
      );
      const expectedCents = order.items.reduce(
        (sum, item) =>
          sum + (scaledInteger(item.count, 2) * scaledInteger(item.unitValue, 2)) / 100n,
        0n,
      );
      expect(scaledInteger(order.total, 2)).toBe(expectedCents);
    }
  });

  it('creates valid ordered histories ending in the persisted terminal or active state', async () => {
    await seedDemoData();
    const [orders, users] = await Promise.all([
      models.WorkOrder.findAll({ order: [['id', 'ASC']] }),
      models.User.findAll(),
    ]);
    const usersById = new Map(users.map((user) => [String(user.id), user]));

    for (const order of orders) {
      const history = await models.WorkOrderStatusHistory.findAll({
        where: { workOrderId: order.id },
        order: [
          ['createdAt', 'ASC'],
          ['id', 'ASC'],
        ],
      });
      expect(history[0]).toMatchObject({
        fromStatus: null,
        toStatus: WORK_ORDER_STATUS.RECEIVED,
        note: null,
      });

      let currentStatus = null;
      for (const [index, event] of history.entries()) {
        expect(event.fromStatus).toBe(currentStatus);
        if (index > 0) expect(canTransition(currentStatus, event.toStatus)).toBe(true);

        const actor = usersById.get(String(event.changedByUserId));
        expect(actor).toBeDefined();
        if (
          [WORK_ORDER_STATUS.DELIVERED, WORK_ORDER_STATUS.CANCELLED].includes(
            event.toStatus,
          )
        ) {
          expect(actor.role).toBe(USER_ROLE.ADMIN);
        }
        currentStatus = event.toStatus;
      }

      expect(currentStatus).toBe(order.status);
      if (
        [WORK_ORDER_STATUS.DELIVERED, WORK_ORDER_STATUS.CANCELLED].includes(
          order.status,
        )
      ) {
        expect(history.at(-1).toStatus).toBe(order.status);
      }
    }
  });

  it('is idempotent and does not duplicate an existing demo dataset', async () => {
    const first = await seedDemoData();
    const before = await Promise.all([
      models.User.count(),
      models.Client.count(),
      models.Bike.count(),
      models.WorkOrder.count(),
      models.WorkOrderItem.count(),
      models.WorkOrderStatusHistory.count(),
    ]);
    const second = await seedDemoData();
    const after = await Promise.all([
      models.User.count(),
      models.Client.count(),
      models.Bike.count(),
      models.WorkOrder.count(),
      models.WorkOrderItem.count(),
      models.WorkOrderStatusHistory.count(),
    ]);

    expect(first.created).toBe(true);
    expect(second).toEqual({
      created: false,
      counts: null,
      statusDistribution: null,
    });
    expect(after).toEqual(before);
  });

  it('preserves unrelated user data when demo markers already exist', async () => {
    const normalClient = await models.Client.create({
      name: 'Cliente existente',
      phone: '3105559988',
      email: 'cliente.real@example.test',
    });
    await seedDemoData();
    await seedDemoData();

    await expect(models.Client.findByPk(normalClient.id)).resolves.toMatchObject({
      name: 'Cliente existente',
      email: 'cliente.real@example.test',
    });
  });
});
