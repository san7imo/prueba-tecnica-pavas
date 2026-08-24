import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  updateWorkOrderStatus,
} from '../controllers/workOrderController.js';
import {
  createWorkOrderItem,
  deleteWorkOrderItem,
} from '../controllers/workOrderItemController.js';
import { authorize } from '../middlewares/authorize.js';
import {
  validateCreateWorkOrderItem,
  validateDeleteWorkOrderItem,
} from '../validators/workOrderItemValidators.js';
import {
  validateCreateWorkOrder,
  validateWorkOrderId,
  validateWorkOrderList,
  validateWorkOrderStatusUpdate,
} from '../validators/workOrderValidators.js';

export const workOrderRouter = Router();

workOrderRouter.post('/', validateCreateWorkOrder, createWorkOrder);
workOrderRouter.get('/', validateWorkOrderList, listWorkOrders);
workOrderRouter.post('/:id/items', validateCreateWorkOrderItem, createWorkOrderItem);
workOrderRouter.delete(
  '/items/:itemId',
  authorize(USER_ROLE.ADMIN),
  validateDeleteWorkOrderItem,
  deleteWorkOrderItem,
);
workOrderRouter.patch(
  '/:id/status',
  validateWorkOrderStatusUpdate,
  updateWorkOrderStatus,
);
workOrderRouter.get('/:id', validateWorkOrderId, getWorkOrder);
