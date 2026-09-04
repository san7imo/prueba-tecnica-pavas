import { UniqueConstraintError } from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { USER_ROLE } from '../constants/auth.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { userRepository } from '../repositories/userRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';

const userNotFound = () =>
  new NotFoundError({ code: 'USER_NOT_FOUND', message: 'User not found.' });

const emailConflict = () =>
  new ConflictError({
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists.',
  });

const lastActiveAdminRequired = () =>
  new ConflictError({
    code: 'LAST_ACTIVE_ADMIN_REQUIRED',
    message: 'At least one active ADMIN user must remain.',
  });

const mechanicHasOpenOrders = () =>
  new ConflictError({
    code: 'MECHANIC_HAS_OPEN_ORDERS',
    message: 'Reassign the mechanic open work orders before changing this user.',
  });

const concurrentModification = () =>
  new ConflictError({
    code: 'CONCURRENT_MODIFICATION_RETRY',
    message: 'The user changed concurrently. Reload it and retry.',
  });

const isDatabaseConcurrencyError = (error) =>
  ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(
    error?.original?.code ?? error?.parent?.code,
  );

const detachedPlain = (resource) => structuredClone(resource.get({ plain: true }));

const indexedUsers = (users) =>
  new Map(users.map((user) => [String(user.id), user]));

const activeAdminCount = (users) =>
  users.filter((user) => user.role === USER_ROLE.ADMIN && user.active).length;

const assertAdminWillRemain = (user, nextState, lockedUsers) => {
  const reducesActiveAdmins =
    user.role === USER_ROLE.ADMIN &&
    user.active &&
    (nextState.role !== USER_ROLE.ADMIN || nextState.active === false);
  if (reducesActiveAdmins && activeAdminCount(lockedUsers) <= 1) {
    throw lastActiveAdminRequired();
  }
};

const assertNoOpenMechanicOrders = async (user, transaction) => {
  const openOrders = await workOrderRepository.findOpenByAssignedMechanicIdForUpdate(
    user.id,
    transaction,
  );
  if (openOrders.length > 0) throw mechanicHasOpenOrders();
};

export const userService = {
  async createUser(data, actor) {
    const email = data.email.trim().toLowerCase();
    const passwordHash = await authService.hashPassword(data.password);

    try {
      const userId = await sequelize.transaction(async (transaction) => {
        const options = { transaction };
        if (await userRepository.findByEmail(email, options)) {
          throw emailConflict();
        }
        const user = await userRepository.create({
          name: data.name.trim(),
          email,
          passwordHash,
          role: data.role,
          active: true,
        }, options);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.USER,
          action: AUDIT_ACTION.CREATED,
          actor,
          after: user,
        }, transaction);
        return user.id;
      });
      return userRepository.findManagedById(userId);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw emailConflict();
      throw error;
    }
  },

  listUsers() {
    return userRepository.listManaged();
  },

  async changeRole(id, { role, reason }, actor) {
    const identity = await userRepository.findById(id);
    if (!identity) throw userNotFound();

    try {
      const userId = await sequelize.transaction(async (transaction) => {
        const mayReduceActiveAdmins =
          identity.role === USER_ROLE.ADMIN &&
          identity.active &&
          role !== USER_ROLE.ADMIN;
        const lockedUsers = await userRepository.findLifecycleLockSet(
          id,
          mayReduceActiveAdmins,
          transaction,
        );
        const user = indexedUsers(lockedUsers).get(String(id));
        if (!user) throw userNotFound();
        if (user.role === role) return user.id;

        const reducesActiveAdmins =
          user.role === USER_ROLE.ADMIN &&
          user.active &&
          role !== USER_ROLE.ADMIN;
        if (reducesActiveAdmins && !mayReduceActiveAdmins) {
          throw concurrentModification();
        }

        assertAdminWillRemain(user, { role, active: user.active }, lockedUsers);
        if (user.role === USER_ROLE.MECHANIC) {
          await assertNoOpenMechanicOrders(user, transaction);
        }

        const before = detachedPlain(user);
        await userRepository.updateRole(user, role, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.USER,
          action: AUDIT_ACTION.ROLE_CHANGED,
          actor,
          before,
          after: user,
          metadata: { previousRole: before.role, newRole: role },
          reason,
        }, transaction);
        return user.id;
      });
      return userRepository.findManagedById(userId);
    } catch (error) {
      if (isDatabaseConcurrencyError(error)) throw concurrentModification();
      throw error;
    }
  },

  async changeActive(id, { active, reason }, actor) {
    const identity = await userRepository.findById(id);
    if (!identity) throw userNotFound();

    try {
      const userId = await sequelize.transaction(async (transaction) => {
        const mayReduceActiveAdmins =
          identity.role === USER_ROLE.ADMIN &&
          identity.active &&
          active === false;
        const lockedUsers = await userRepository.findLifecycleLockSet(
          id,
          mayReduceActiveAdmins,
          transaction,
        );
        const user = indexedUsers(lockedUsers).get(String(id));
        if (!user) throw userNotFound();
        if (user.active === active) return user.id;

        const reducesActiveAdmins =
          user.role === USER_ROLE.ADMIN &&
          user.active &&
          active === false;
        if (reducesActiveAdmins && !mayReduceActiveAdmins) {
          throw concurrentModification();
        }

        assertAdminWillRemain(user, { role: user.role, active }, lockedUsers);
        if (user.role === USER_ROLE.MECHANIC && active === false) {
          await assertNoOpenMechanicOrders(user, transaction);
        }

        const before = detachedPlain(user);
        await userRepository.updateActive(user, active, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.USER,
          action: active ? AUDIT_ACTION.ACTIVATED : AUDIT_ACTION.DEACTIVATED,
          actor,
          before,
          after: user,
          metadata: { previousActive: before.active, newActive: active },
          reason,
        }, transaction);
        return user.id;
      });
      return userRepository.findManagedById(userId);
    } catch (error) {
      if (isDatabaseConcurrencyError(error)) throw concurrentModification();
      throw error;
    }
  },
};
