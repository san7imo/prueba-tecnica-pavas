import { ForeignKeyConstraintError } from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import { WORK_ORDER_STATUS } from '../constants/workOrder.js';
import { BusinessRuleError } from '../errors/BusinessRuleError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';
import { canTransition } from '../utils/workOrderStateMachine.js';

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

export const workOrderService = {
  async createWorkOrder(data) {
    if (!(await bikeRepository.existsById(data.bikeId))) {
      throw bikeNotFound();
    }

    try {
      const workOrder = await workOrderRepository.create({
        bikeId: data.bikeId,
        entryDate: data.entryDate ?? new Date(),
        faultDescription: data.faultDescription.trim(),
        status: WORK_ORDER_STATUS.RECEIVED,
        total: '0.00',
      });
      return workOrderRepository.findById(workOrder.id);
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw bikeNotFound();
      }
      throw error;
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

  transitionStatus(id, { toStatus }) {
    return sequelize.transaction(async (transaction) => {
      const workOrder = await workOrderRepository.findByIdForUpdate(
        id,
        transaction,
      );
      if (!workOrder) {
        throw workOrderNotFound();
      }

      if (!canTransition(workOrder.status, toStatus)) {
        throw invalidStatusTransition(workOrder.status, toStatus);
      }

      await workOrderRepository.updateStatus(id, toStatus, transaction);
      return { id: workOrder.id, status: toStatus };
    });
  },
};
