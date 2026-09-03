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
import { WORK_ORDER_STATUS } from '../constants/workOrder.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';
import { BusinessRuleError } from '../errors/BusinessRuleError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { clientRepository } from '../repositories/clientRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { workOrderStatusHistoryRepository } from '../repositories/workOrderStatusHistoryRepository.js';
import { canTransition } from '../utils/workOrderStateMachine.js';
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

  async listWorkOrders(filters) {
    const { count, rows } = await workOrderRepository.findPaginated(filters);
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

  async getWorkOrder(id) {
    const workOrder = await workOrderRepository.findById(id);
    if (!workOrder) {
      throw workOrderNotFound();
    }
    return workOrder;
  },

  async listStatusHistory(id, pagination) {
    if (!(await workOrderRepository.existsById(id))) {
      throw workOrderNotFound();
    }

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

        if (!canTransition(workOrder.status, toStatus)) {
          throw invalidStatusTransition(workOrder.status, toStatus);
        }

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
            : { transitionKind: AUDIT_TRANSITION_KIND.FORWARD },
          reason: note,
        }, transaction);
        return { id: workOrder.id, status: toStatus };
      });
    } catch (error) {
      return translatePersistenceConflict(error);
    }
  },
};
