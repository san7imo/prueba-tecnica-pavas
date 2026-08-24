import { Router } from 'express';

import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
} from '../controllers/workOrderController.js';
import {
  createWorkOrderItem,
  deleteWorkOrderItem,
} from '../controllers/workOrderItemController.js';
import {
  validateCreateWorkOrderItem,
  validateDeleteWorkOrderItem,
} from '../validators/workOrderItemValidators.js';
import {
  validateCreateWorkOrder,
  validateWorkOrderId,
  validateWorkOrderList,
} from '../validators/workOrderValidators.js';

export const workOrderRouter = Router();

workOrderRouter.post('/', validateCreateWorkOrder, createWorkOrder);
workOrderRouter.get('/', validateWorkOrderList, listWorkOrders);
workOrderRouter.post('/:id/items', validateCreateWorkOrderItem, createWorkOrderItem);
workOrderRouter.delete(
  '/items/:itemId',
  validateDeleteWorkOrderItem,
  deleteWorkOrderItem,
);
workOrderRouter.get('/:id', validateWorkOrderId, getWorkOrder);
