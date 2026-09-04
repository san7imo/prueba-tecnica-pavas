import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { USER_ROLE } from '../constants/auth.js';
import { OPEN_WORK_ORDER_STATUSES } from '../constants/workOrder.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { workOrderItemRepository } from '../repositories/workOrderItemRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { auditService } from './auditService.js';

const workOrderNotAssignedToActor = () =>
  new AuthorizationError({
    code: 'WORK_ORDER_NOT_ASSIGNED_TO_ACTOR',
    message: 'The work order is not assigned to the authenticated mechanic.',
  });

const workOrderNotFound = () =>
  new NotFoundError({
    code: 'WORK_ORDER_NOT_FOUND',
    message: 'Work order not found.',
  });

const workOrderItemNotFound = () =>
  new NotFoundError({
    code: 'WORK_ORDER_ITEM_NOT_FOUND',
    message: 'Work-order item not found.',
  });

const workOrderClosed = () =>
  new ConflictError({
    code: 'WORK_ORDER_CLOSED',
    message: 'Closed work orders cannot be modified.',
  });

const assertOpenWorkOrder = (workOrder) => {
  if (!OPEN_WORK_ORDER_STATUSES.includes(workOrder.status)) {
    throw workOrderClosed();
  }
};

const persistExactTotal = async (workOrderId, transaction) => {
  const total = await workOrderItemRepository.calculateTotal(
    workOrderId,
    transaction,
  );
  await workOrderRepository.updateTotal(workOrderId, total, transaction);
  return total;
};

export const workOrderItemService = {
  addItem(workOrderId, data, actor) {
    return sequelize.transaction(async (transaction) => {
      const workOrder = await workOrderRepository.findByIdForUpdate(
        workOrderId,
        transaction,
      );
      if (!workOrder) {
        throw workOrderNotFound();
      }
      if (
        actor.role === USER_ROLE.MECHANIC &&
        String(workOrder.assignedMechanicId ?? '') !== String(actor.id)
      ) {
        throw workOrderNotAssignedToActor();
      }
      assertOpenWorkOrder(workOrder);

      const item = await workOrderItemRepository.create(
        {
          workOrderId,
          type: data.type,
          description: data.description,
          count: data.count,
          unitValue: data.unitValue,
          createdByUserId: actor.id,
        },
        transaction,
      );
      const workOrderTotal = await persistExactTotal(workOrderId, transaction);
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM,
        action: AUDIT_ACTION.ITEM_ADDED,
        actor,
        after: item,
      }, transaction);

      return {
        item: await workOrderItemRepository.findByIdWithCreator(
          item.id,
          transaction,
        ),
        workOrderTotal,
      };
    });
  },

  async deleteItem(itemId, actor) {
    const itemReference = await workOrderItemRepository.findById(itemId);
    if (!itemReference) {
      throw workOrderItemNotFound();
    }

    return sequelize.transaction(async (transaction) => {
      const workOrder = await workOrderRepository.findByIdForUpdate(
        itemReference.workOrderId,
        transaction,
      );
      if (!workOrder) {
        throw workOrderNotFound();
      }
      assertOpenWorkOrder(workOrder);

      const item = await workOrderItemRepository.findByIdForWorkOrderForUpdate(
        itemId,
        itemReference.workOrderId,
        transaction,
      );
      if (!item) {
        throw workOrderItemNotFound();
      }

      const deletedCount = await workOrderItemRepository.deleteById(
        itemId,
        transaction,
      );
      if (deletedCount !== 1) {
        throw workOrderItemNotFound();
      }

      const workOrderTotal = await persistExactTotal(
        itemReference.workOrderId,
        transaction,
      );
      await auditService.record({
        entityType: AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM,
        action: AUDIT_ACTION.ITEM_DELETED,
        actor,
        before: item,
      }, transaction);

      return { deletedItemId: item.id, workOrderTotal };
    });
  },
};
