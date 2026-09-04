import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
let mechanic;
let mechanicAccessToken;

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

const createAssignedOrder = async (assignedMechanicId, plate = 'USR001') => {
  const client = await models.Client.create({
    name: `User lifecycle client ${plate}`,
    phone: `300${plate.replace(/\D/g, '').padEnd(7, '0')}`,
  });
  const bike = await models.Bike.create({
    plate,
    brand: 'Honda',
    model: 'CB 190R',
    clientId: client.id,
  });
  return models.WorkOrder.create({
    bikeId: bike.id,
    entryDate: new Date('2026-09-03T15:00:00.000Z'),
    faultDescription: 'User lifecycle assignment.',
    status: WORK_ORDER_STATUS.RECEIVED,
    total: '0.00',
    assignedMechanicId,
  });
};

const userEvents = (userId) =>
  models.AuditEvent.findAll({
    where: {
      entityType: AUDIT_ENTITY_TYPE.USER,
      entityId: userId,
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
});

beforeEach(async () => {
  await cleanDatabase();
  ({ user: admin, accessToken: adminAccessToken } = await createTestIdentity({
    name: 'Lifecycle Admin',
    email: 'lifecycle.admin@example.test',
    role: USER_ROLE.ADMIN,
  }));
  ({ user: mechanic, accessToken: mechanicAccessToken } = await createTestIdentity({
    name: 'Lifecycle Mechanic',
    email: 'lifecycle.mechanic@example.test',
    role: USER_ROLE.MECHANIC,
  }));
});

afterAll(async () => {
  if (migrator) await migrator.down({ to: 0 });
  await sequelize.close();
});

describe.sequential('HITO 13 user lifecycle hardening', () => {
  it('requires a non-empty bounded reason for role and active changes', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);

    const roleResponse = await adminRequest
      .patch(`/api/users/${mechanic.id}/role`)
      .send({ role: USER_ROLE.ADMIN });
    expect(roleResponse.status).toBe(400);
    expect(roleResponse.body.error.details).toContainEqual({
      field: 'reason',
      message: 'Reason is required.',
    });

    const activeResponse = await adminRequest
      .patch(`/api/users/${mechanic.id}/active`)
      .send({ active: false, reason: '   ' });
    expect(activeResponse.status).toBe(400);
    expect(activeResponse.body.error.details).toContainEqual({
      field: 'reason',
      message: 'Reason is required.',
    });
  });

  it('rejects deactivation or demotion of the last active ADMIN', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);

    const deactivation = await adminRequest
      .patch(`/api/users/${admin.id}/active`)
      .send({ active: false, reason: 'Attempt to remove last admin.' });
    expect(deactivation.status).toBe(409);
    expect(deactivation.body.error.code).toBe('LAST_ACTIVE_ADMIN_REQUIRED');

    const roleChange = await adminRequest
      .patch(`/api/users/${admin.id}/role`)
      .send({ role: USER_ROLE.MECHANIC, reason: 'Attempt to remove last admin.' });
    expect(roleChange.status).toBe(409);
    expect(roleChange.body.error.code).toBe('LAST_ACTIVE_ADMIN_REQUIRED');

    await admin.reload();
    expect(admin).toMatchObject({ role: USER_ROLE.ADMIN, active: true });
    expect(await userEvents(admin.id)).toHaveLength(0);
  });

  it('audits a successful ADMIN lifecycle change with safe snapshots and reason', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const { user: secondAdmin } = await createTestIdentity({
      name: 'Second Lifecycle Admin',
      email: 'lifecycle.second-admin@example.test',
      role: USER_ROLE.ADMIN,
    });

    const response = await adminRequest
      .patch(`/api/users/${secondAdmin.id}/active`)
      .send({ active: false, reason: 'Planned leave.' });
    expect(response.status).toBe(200);
    expect(response.body.data.active).toBe(false);

    const [event] = await userEvents(secondAdmin.id);
    expect(event).toMatchObject({
      action: AUDIT_ACTION.DEACTIVATED,
      actorUserId: admin.id,
      reason: 'Planned leave.',
      metadata: { previousActive: true, newActive: false },
    });
    expect(event.beforeData).toMatchObject({ active: true, role: USER_ROLE.ADMIN });
    expect(event.afterData).toMatchObject({ active: false, role: USER_ROLE.ADMIN });
    expect(JSON.stringify(event.toJSON())).not.toMatch(/password|token|cookie|secret/i);
  });

  it('audits a successful role change with its previous and new roles', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const response = await adminRequest
      .patch(`/api/users/${mechanic.id}/role`)
      .send({ role: USER_ROLE.ADMIN, reason: 'Promotion to workshop lead.' });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe(USER_ROLE.ADMIN);
    const [event] = await userEvents(mechanic.id);
    expect(event).toMatchObject({
      action: AUDIT_ACTION.ROLE_CHANGED,
      actorUserId: admin.id,
      reason: 'Promotion to workshop lead.',
      metadata: {
        previousRole: USER_ROLE.MECHANIC,
        newRole: USER_ROLE.ADMIN,
      },
    });
    expect(event.beforeData.role).toBe(USER_ROLE.MECHANIC);
    expect(event.afterData.role).toBe(USER_ROLE.ADMIN);
  });

  it('blocks mechanic deactivation and role removal while open orders remain assigned', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const order = await createAssignedOrder(mechanic.id);

    const deactivation = await adminRequest
      .patch(`/api/users/${mechanic.id}/active`)
      .send({ active: false, reason: 'End mechanic access.' });
    expect(deactivation.status).toBe(409);
    expect(deactivation.body.error.code).toBe('MECHANIC_HAS_OPEN_ORDERS');

    const roleChange = await adminRequest
      .patch(`/api/users/${mechanic.id}/role`)
      .send({ role: USER_ROLE.ADMIN, reason: 'Move mechanic to administration.' });
    expect(roleChange.status).toBe(409);
    expect(roleChange.body.error.code).toBe('MECHANIC_HAS_OPEN_ORDERS');

    await mechanic.reload();
    await order.reload();
    expect(mechanic).toMatchObject({ role: USER_ROLE.MECHANIC, active: true });
    expect(order.assignedMechanicId).toBe(mechanic.id);
    expect(await userEvents(mechanic.id)).toHaveLength(0);
  });

  it('allows deactivation after the open orders are reassigned', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const { user: replacement } = await createTestIdentity({
      name: 'Replacement Mechanic',
      email: 'lifecycle.replacement@example.test',
      role: USER_ROLE.MECHANIC,
    });
    const order = await createAssignedOrder(mechanic.id);

    await adminRequest
      .patch(`/api/work-orders/${order.id}/assignment`)
      .send({ mechanicId: replacement.id, reason: 'Coverage reassignment.' })
      .expect(200);
    const response = await adminRequest
      .patch(`/api/users/${mechanic.id}/active`)
      .send({ active: false, reason: 'No remaining operational work.' });

    expect(response.status).toBe(200);
    expect(response.body.data.active).toBe(false);
    expect((await order.reload()).assignedMechanicId).toBe(replacement.id);
    const [event] = await userEvents(mechanic.id);
    expect(event).toMatchObject({
      action: AUDIT_ACTION.DEACTIVATED,
      reason: 'No remaining operational work.',
    });
  });

  it('serializes concurrent ADMIN reductions so one active ADMIN always remains', async () => {
    const { user: secondAdmin, accessToken: secondAdminAccessToken } =
      await createTestIdentity({
        name: 'Concurrent Lifecycle Admin',
        email: 'lifecycle.concurrent-admin@example.test',
        role: USER_ROLE.ADMIN,
      });
    const firstRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const secondRequest = createAuthenticatedRequest(() => secondAdminAccessToken)(app);

    const responses = await Promise.all([
      firstRequest.patch(`/api/users/${admin.id}/role`).send({
        role: USER_ROLE.MECHANIC,
        reason: 'Concurrent role reduction.',
      }),
      secondRequest.patch(`/api/users/${secondAdmin.id}/active`).send({
        active: false,
        reason: 'Concurrent access reduction.',
      }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(responses.find(({ status }) => status === 409).body.error.code)
      .toBe('LAST_ACTIVE_ADMIN_REQUIRED');
    expect(await models.User.count({
      where: { role: USER_ROLE.ADMIN, active: true },
    })).toBe(1);
    expect(await models.AuditEvent.count({
      where: {
        entityType: AUDIT_ENTITY_TYPE.USER,
        action: [AUDIT_ACTION.ROLE_CHANGED, AUDIT_ACTION.DEACTIVATED],
      },
    })).toBe(1);
  });

  it('serializes assignment against deactivation without leaving an inactive assignee', async () => {
    const adminRequest = createAuthenticatedRequest(() => adminAccessToken)(app);
    const order = await createAssignedOrder(null, 'USR002');

    const [assignment, deactivation] = await Promise.all([
      adminRequest
        .patch(`/api/work-orders/${order.id}/assignment`)
        .send({ mechanicId: mechanic.id }),
      adminRequest
        .patch(`/api/users/${mechanic.id}/active`)
        .send({ active: false, reason: 'Concurrent deactivation.' }),
    ]);

    expect([assignment.status, deactivation.status].sort()).toEqual([200, 409]);
    if (assignment.status === 200) {
      expect(deactivation.body.error.code).toBe('MECHANIC_HAS_OPEN_ORDERS');
    } else {
      expect(assignment.body.error.code).toBe('MECHANIC_INACTIVE');
    }
    await mechanic.reload();
    await order.reload();
    expect(!(order.assignedMechanicId === mechanic.id && mechanic.active === false)).toBe(true);
  });

  it('keeps authentication authorization ahead of lifecycle validation', async () => {
    const mechanicRequest = createAuthenticatedRequest(() => mechanicAccessToken)(app);
    const response = await mechanicRequest
      .patch('/api/users/not-an-id/active')
      .send({ active: 'invalid' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
