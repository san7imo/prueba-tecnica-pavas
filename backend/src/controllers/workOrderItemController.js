import { workOrderItemService } from '../services/workOrderItemService.js';
import { serializeWorkOrderItem } from '../utils/resourceSerializers.js';

export const createWorkOrderItem = async (request, response) => {
  const result = await workOrderItemService.addItem(
    request.validated.params.id,
    request.validated.body,
    request.user,
  );

  response.status(201).json({
    data: {
      item: serializeWorkOrderItem(result.item),
      workOrderTotal: result.workOrderTotal,
    },
  });
};

export const deleteWorkOrderItem = async (request, response) => {
  const result = await workOrderItemService.deleteItem(
    request.validated.params.itemId,
  );

  response.json({ data: result });
};
