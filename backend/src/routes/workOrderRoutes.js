import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  listWorkOrderStatusHistory,
  reopenWorkOrder,
  updateWorkOrderAssignment,
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
  validateWorkOrderAssignment,
  validateWorkOrderHistoryList,
  validateWorkOrderId,
  validateWorkOrderList,
  validateWorkOrderReopen,
  validateWorkOrderStatusUpdate,
} from '../validators/workOrderValidators.js';

export const workOrderRouter = Router();

workOrderRouter.post(
  '/',
  authorize(USER_ROLE.ADMIN),
  validateCreateWorkOrder,
  createWorkOrder,
);
workOrderRouter.get('/', validateWorkOrderList, listWorkOrders);
workOrderRouter.post('/:id/items', validateCreateWorkOrderItem, createWorkOrderItem);
workOrderRouter.delete(
  '/items/:itemId',
  authorize(USER_ROLE.ADMIN),
  validateDeleteWorkOrderItem,
  deleteWorkOrderItem,
);
workOrderRouter.patch(
  '/:id/assignment',
  authorize(USER_ROLE.ADMIN),
  validateWorkOrderAssignment,
  updateWorkOrderAssignment,
);
workOrderRouter.patch(
  '/:id/status',
  validateWorkOrderStatusUpdate,
  updateWorkOrderStatus,
);
workOrderRouter.post(
  '/:id/reopen',
  authorize(USER_ROLE.ADMIN),
  validateWorkOrderReopen,
  reopenWorkOrder,
);
workOrderRouter.get(
  '/:id/history',
  validateWorkOrderHistoryList,
  listWorkOrderStatusHistory,
);
workOrderRouter.get('/:id', validateWorkOrderId, getWorkOrder);
