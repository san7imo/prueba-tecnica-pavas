import { Router } from 'express';

import {
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
} from '../controllers/workOrderController.js';
import {
  validateCreateWorkOrder,
  validateWorkOrderId,
  validateWorkOrderList,
} from '../validators/workOrderValidators.js';

export const workOrderRouter = Router();

workOrderRouter.post('/', validateCreateWorkOrder, createWorkOrder);
workOrderRouter.get('/', validateWorkOrderList, listWorkOrders);
workOrderRouter.get('/:id', validateWorkOrderId, getWorkOrder);
