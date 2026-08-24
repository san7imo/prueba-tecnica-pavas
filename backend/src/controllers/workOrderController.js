import { workOrderService } from '../services/workOrderService.js';
import { serializeWorkOrder } from '../utils/resourceSerializers.js';

export const createWorkOrder = async (request, response) => {
  const workOrder = await workOrderService.createWorkOrder(request.validated.body);
  response.status(201).json({ data: serializeWorkOrder(workOrder) });
};

export const listWorkOrders = async (request, response) => {
  const result = await workOrderService.listWorkOrders(request.validated.query);
  response.json({
    data: result.workOrders.map(serializeWorkOrder),
    meta: result.meta,
  });
};

export const getWorkOrder = async (request, response) => {
  const workOrder = await workOrderService.getWorkOrder(request.validated.params.id);
  response.json({ data: serializeWorkOrder(workOrder) });
};
