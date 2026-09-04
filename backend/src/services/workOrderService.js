import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  AUDIT_TRANSITION_KIND,
} from '../constants/audit.js';
import { USER_ROLE } from '../constants/auth.js';
import {
  OPEN_WORK_ORDER_STATUSES,
  WORK_ORDER_SCOPE,
  WORK_ORDER_STATUS,
} from '../constants/workOrder.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';
import { BusinessRuleError } from '../errors/BusinessRuleError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { workOrderStatusHistoryRepository } from '../repositories/workOrderStatusHistoryRepository.js';
import {
  canTransition,
  isRegressionTransition,
} from '../utils/workOrderStateMachine.js';
import { auditService } from './auditService.js';

const bikeNotFound = () =>
  new NotFoundError({
    code: 'BIKE_NOT_FOUND',
    message: 'Bike not found.',
  });

const workOrderNotFound = () =>
  new NotFoundError({
    code: 'WORK_ORDER_NOT_FOUND',
    message: 'Work order not found.',
  });

const invalidStatusTransition = (fromStatus, toStatus) =>
  new BusinessRuleError({
    code: 'INVALID_STATUS_TRANSITION',
    message: `Cannot transition work order from ${fromStatus} to ${toStatus}.`,
  });

const statusRegressionReasonRequired = () =>
  new BusinessRuleError({
    code: 'STATUS_REGRESSION_REASON_REQUIRED',
    message: 'A non-empty reason is required for a backward status transition.',
  });

const bikeHasActiveWorkOrder = () =>
  new ConflictError({
    code: 'BIKE_HAS_ACTIVE_WORK_ORDER',
    message: 'Motorcycle already has an open work order.',
  });

const concurrentModification = () =>
  new ConflictError({
    code: 'CONCURRENT_MODIFICATION_RETRY',
    message: 'The work order changed concurrently. Reload it and retry.',
  });

const mechanicNotFound = () =>
  new NotFoundError({
    code: 'MECHANIC_NOT_FOUND',
    message: 'Mechanic not found.',
  });

const mechanicInactive = () =>
  new ConflictError({
    code: 'MECHANIC_INACTIVE',
    message: 'Only an active mechanic can be assigned.',
  });

const assigneeMustBeMechanic = () =>
  new ConflictError({
    code: 'ASSIGNEE_MUST_BE_MECHANIC',
    message: 'Only a user with the MECANICO role can be assigned.',
  });

const workOrderClosed = () =>
  new ConflictError({
    code: 'WORK_ORDER_CLOSED',
    message: 'A closed work order cannot be assigned or reassigned.',
  });

const assignmentReasonRequired = () =>
  new BusinessRuleError({
    code: 'ASSIGNMENT_REASON_REQUIRED',
    message: 'A reason is required to reassign or unassign a work order.',
  });

const assignmentUnchanged = () =>
  new BusinessRuleError({
    code: 'ASSIGNMENT_UNCHANGED',
    message: 'The work order is already assigned to that mechanic.',
  });

const invalidAssignmentFilters = () =>
  new BusinessRuleError({
    code: 'INVALID_ASSIGNMENT_FILTERS',
    message: 'Unassigned scope cannot be combined with an assigned mechanic filter.',
  });

const workOrderNotAssignedToActor = () =>
  new AuthorizationError({
    code: 'WORK_ORDER_NOT_ASSIGNED_TO_ACTOR',
    message: 'The work order is not assigned to the authenticated mechanic.',
  });

const assertMechanicOwnership = (workOrder, actor) => {
  if (
    actor.role === USER_ROLE.MECHANIC &&
    String(workOrder.assignedMechanicId ?? '') !== String(actor.id)
  ) {
    throw workOrderNotAssignedToActor();
  }
};

const scopedListFilters = (filters, actor) => {
  const scope = filters.scope ?? (
    actor.role === USER_ROLE.MECHANIC
      ? WORK_ORDER_SCOPE.MINE
      : WORK_ORDER_SCOPE.ALL
  );

  if (actor.role === USER_ROLE.MECHANIC) {
    if (
      scope !== WORK_ORDER_SCOPE.MINE ||
      (
        filters.assignedMechanicId !== undefined &&
        String(filters.assignedMechanicId) !== String(actor.id)
      )
    ) {
      throw new AuthorizationError();
    }
    return { ...filters, scope, assignedMechanicId: actor.id };
  }

  if (scope === WORK_ORDER_SCOPE.UNASSIGNED) {
    if (filters.assignedMechanicId !== undefined) {
      throw invalidAssignmentFilters();
    }
    return { ...filters, scope, assignedMechanicId: null };
  }

  if (scope === WORK_ORDER_SCOPE.MINE) {
    return { ...filters, scope, assignedMechanicId: actor.id };
  }

  return { ...filters, scope };
};

const plain = (resource) =>
  typeof resource?.get === 'function' ? resource.get({ plain: true }) : resource;

const detachedPlain = (resource) => structuredClone(plain(resource));

const indexedUsers = (users) =>
  new Map(users.map((user) => [String(user.id), user]));

const assignmentIds = (...ids) =>
  [...new Set(ids.filter((id) => id !== null && id !== undefined).map(String))]
    .sort((left, right) => {
      const leftId = BigInt(left);
      const rightId = BigInt(right);
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });

const assertAssignableMechanic = (mechanic) => {
  if (!mechanic) throw mechanicNotFound();
  if (mechanic.role !== USER_ROLE.MECHANIC) throw assigneeMustBeMechanic();
  if (!mechanic.active) throw mechanicInactive();
};

const isDatabaseConcurrencyError = (error) =>
  ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(
    error?.original?.code ?? error?.parent?.code,
  );

const isOpenBikeUniqueConstraint = (error) => {
  if (!(error instanceof UniqueConstraintError)) return false;
  const details = [
    error?.parent?.constraint,
    error?.parent?.sqlMessage,
    error?.original?.sqlMessage,
    ...Object.keys(error.fields ?? {}),
  ].filter(Boolean).join(' ');
  return /uq_work_orders_open_bike|open_bike_id/i.test(details);
};

const translatePersistenceConflict = (error) => {
  if (isOpenBikeUniqueConstraint(error)) throw bikeHasActiveWorkOrder();
  if (isDatabaseConcurrencyError(error)) throw concurrentModification();
  throw error;
};

export const workOrderService = {
  async createWorkOrder(data, actor) {
    const identity = await bikeRepository.findIdentityById(data.bikeId);
    if (!identity) throw bikeNotFound();

    try {
      const workOrderId = await sequelize.transaction(async (transaction) => {
        const owner = await clientRepository.findByIdForUpdate(
          identity.clientId,
          transaction,
        );
        const bike = await bikeRepository.findByIdForUpdate(
          data.bikeId,
          transaction,
        );
        if (!bike) throw bikeNotFound();
        if (String(bike.clientId) !== String(identity.clientId)) {
          throw new ConflictError({
            code: 'CONCURRENT_MODIFICATION_RETRY',
            message: 'The motorcycle changed concurrently. Reload it and retry.',
          });
        }
        if (bike.deletedAt !== null) {
          throw new ConflictError({
            code: 'BIKE_INACTIVE',
            message: 'Deleted motorcycles cannot receive new work orders.',
          });
        }
        if (!owner || owner.deletedAt !== null) {
          throw new ConflictError({
            code: 'BIKE_OWNER_INACTIVE',
            message: 'The motorcycle owner must be active.',
          });
        }

        let assignedMechanic = null;
        if (data.assignedMechanicId !== undefined) {
          [assignedMechanic] = await userRepository.findByIdsForUpdate(
            [data.assignedMechanicId],
            transaction,
          );
          assertAssignableMechanic(assignedMechanic);
        }

        const openOrders = await workOrderRepository.findOpenByBikeIdForUpdate(
          bike.id,
          transaction,
        );
        if (openOrders.length > 0) throw bikeHasActiveWorkOrder();

        const workOrder = await workOrderRepository.create({
          bikeId: data.bikeId,
          entryDate: data.entryDate ?? new Date(),
          faultDescription: data.faultDescription.trim(),
          status: WORK_ORDER_STATUS.RECEIVED,
          total: '0.00',
          assignedMechanicId: assignedMechanic?.id ?? null,
        }, transaction);
        await workOrderStatusHistoryRepository.create({
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: WORK_ORDER_STATUS.RECEIVED,
          note: null,
          changedByUserId: actor.id,
        }, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
          action: AUDIT_ACTION.CREATED,
          actor,
          after: workOrder,
        }, transaction);

        return workOrder.id;
      });
      return workOrderRepository.findById(workOrderId);
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw bikeNotFound();
      }
      return translatePersistenceConflict(error);
    }
  },

  async listWorkOrders(filters, actor) {
    const effectiveFilters = scopedListFilters(filters, actor);
    const { count, rows } = await workOrderRepository.findPaginated(effectiveFilters);
    return {
      workOrders: rows,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / filters.pageSize),
      },
    };
  },

  async changeAssignment(id, { mechanicId, reason }, actor) {
    const identity = await workOrderRepository.findIdentityById(id);
    if (!identity) throw workOrderNotFound();

    try {
      const workOrderId = await sequelize.transaction(async (transaction) => {
        const users = indexedUsers(await userRepository.findByIdsForUpdate(
          assignmentIds(identity.assignedMechanicId, mechanicId),
          transaction,
        ));
        const destinationMechanic = mechanicId === null
          ? null
          : users.get(String(mechanicId));

        const workOrder = await workOrderRepository.findByIdForUpdate(
          id,
          transaction,
        );
        if (!workOrder) throw workOrderNotFound();
        if (
          String(workOrder.assignedMechanicId ?? '') !==
          String(identity.assignedMechanicId ?? '')
        ) {
          throw concurrentModification();
        }
        if (!OPEN_WORK_ORDER_STATUSES.includes(workOrder.status)) {
          throw workOrderClosed();
        }
        if (destinationMechanic) assertAssignableMechanic(destinationMechanic);
        if (mechanicId !== null && !destinationMechanic) throw mechanicNotFound();

        const previousMechanicId = workOrder.assignedMechanicId ?? null;
        if (String(previousMechanicId ?? '') === String(mechanicId ?? '')) {
          throw assignmentUnchanged();
        }
        if (previousMechanicId !== null && reason === null) {
          throw assignmentReasonRequired();
        }

        const before = detachedPlain(workOrder);
        await workOrderRepository.updateAssignment(
          workOrder,
          mechanicId,
          transaction,
        );
        const action = previousMechanicId === null
          ? AUDIT_ACTION.ASSIGNED
          : mechanicId === null
            ? AUDIT_ACTION.UNASSIGNED
            : AUDIT_ACTION.REASSIGNED;
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
          action,
          actor,
          before,
          after: workOrder,
          metadata: {
            previousMechanicId,
            newMechanicId: mechanicId,
          },
          reason,
        }, transaction);
        return workOrder.id;
      });
      return workOrderRepository.findById(workOrderId);
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) throw mechanicNotFound();
      return translatePersistenceConflict(error);
    }
  },

  async getWorkOrder(id, actor) {
    const workOrder = await workOrderRepository.findById(id);
    if (!workOrder) {
      throw workOrderNotFound();
    }
    assertMechanicOwnership(workOrder, actor);
    return workOrder;
  },

  async listStatusHistory(id, pagination, actor) {
    const identity = await workOrderRepository.findIdentityById(id);
    if (!identity) throw workOrderNotFound();
    assertMechanicOwnership(identity, actor);

    const { count, rows } =
      await workOrderStatusHistoryRepository.findPaginatedByWorkOrder(
        id,
        pagination,
      );
    return {
      history: rows,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / pagination.pageSize),
      },
    };
  },

  async transitionStatus(id, { toStatus, note }, actor) {
    const identity = await workOrderRepository.findIdentityById(id);
    if (!identity) throw workOrderNotFound();

    try {
      return await sequelize.transaction(async (transaction) => {
        const closesOrder = [
          WORK_ORDER_STATUS.DELIVERED,
          WORK_ORDER_STATUS.CANCELLED,
        ].includes(toStatus);
        if (closesOrder) {
          const bike = await bikeRepository.findByIdForUpdate(
            identity.bikeId,
            transaction,
          );
          if (!bike) throw workOrderNotFound();
        }

        const workOrder = await workOrderRepository.findByIdForUpdate(
          id,
          transaction,
        );
        if (!workOrder) throw workOrderNotFound();
        if (String(workOrder.bikeId) !== String(identity.bikeId)) {
          throw concurrentModification();
        }
        assertMechanicOwnership(workOrder, actor);

        if (!canTransition(workOrder.status, toStatus)) {
          throw invalidStatusTransition(workOrder.status, toStatus);
        }

        const transitionKind = isRegressionTransition(
          workOrder.status,
          toStatus,
        )
          ? AUDIT_TRANSITION_KIND.REGRESSION
          : AUDIT_TRANSITION_KIND.FORWARD;

        if (
          actor.role === USER_ROLE.MECHANIC &&
          ![
            WORK_ORDER_STATUS.DIAGNOSIS,
            WORK_ORDER_STATUS.IN_PROGRESS,
            WORK_ORDER_STATUS.READY,
          ].includes(toStatus)
        ) {
          throw new AuthorizationError();
        }
        if (
          transitionKind === AUDIT_TRANSITION_KIND.REGRESSION &&
          note === null
        ) {
          throw statusRegressionReasonRequired();
        }

        await workOrderRepository.updateStatus(id, toStatus, transaction);
        await workOrderStatusHistoryRepository.create({
          workOrderId: workOrder.id,
          fromStatus: workOrder.status,
          toStatus,
          note,
          changedByUserId: actor.id,
        }, transaction);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.WORK_ORDER,
          action: toStatus === WORK_ORDER_STATUS.CANCELLED
            ? AUDIT_ACTION.CANCELLED
            : AUDIT_ACTION.STATUS_CHANGED,
          actor,
          before: workOrder,
          after: {
            id: workOrder.id,
            bikeId: workOrder.bikeId,
            entryDate: workOrder.entryDate,
            faultDescription: workOrder.faultDescription,
            status: toStatus,
            total: workOrder.total,
            assignedMechanicId: workOrder.assignedMechanicId,
          },
          metadata: toStatus === WORK_ORDER_STATUS.CANCELLED
            ? null
            : { transitionKind },
          reason: note,
        }, transaction);
        return { id: workOrder.id, status: toStatus };
      });
    } catch (error) {
      return translatePersistenceConflict(error);
    }
  },
};
