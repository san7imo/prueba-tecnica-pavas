import { ForeignKeyConstraintError } from 'sequelize';

import { WORK_ORDER_STATUS } from '../constants/workOrder.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { bikeRepository } from '../repositories/bikeRepository.js';
import { workOrderRepository } from '../repositories/workOrderRepository.js';

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
};
