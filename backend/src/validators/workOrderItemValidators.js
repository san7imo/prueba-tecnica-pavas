import { WORK_ORDER_ITEM_TYPES } from '../constants/workOrder.js';
import { normalizeDecimal } from '../utils/normalizeDecimal.js';
import {
  asObject,
  completeValidation,
  positiveId,
  requiredString,
} from './validationUtils.js';

export const validateCreateWorkOrderItem = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Work order id',
    details,
  });
  const type = requiredString({
    value: body.type,
    field: 'type',
    label: 'Type',
    maxLength: 30,
    details,
  });
  const description = requiredString({
    value: body.description,
    field: 'description',
    label: 'Description',
    maxLength: 255,
    details,
  });
  const count = normalizeDecimal({
    value: body.count,
    field: 'count',
    label: 'Count',
    precision: 10,
    scale: 2,
    allowZero: false,
    details,
  });
  const unitValue = normalizeDecimal({
    value: body.unitValue,
    field: 'unitValue',
    label: 'Unit value',
    precision: 15,
    scale: 2,
    allowZero: true,
    details,
  });

  if (type !== undefined && !WORK_ORDER_ITEM_TYPES.includes(type)) {
    details.push({
      field: 'type',
      message: 'Type must be MANO_OBRA or REPUESTO.',
    });
  }

  if (details.length > 0) {
    completeValidation({ request, section: 'body', value: {}, details, next });
    return;
  }

  request.validated = {
    params: { id },
    body: { type, description, count, unitValue },
  };
  next();
};

export const validateDeleteWorkOrderItem = (request, _response, next) => {
  const details = [];
  const itemId = positiveId({
    value: request.params.itemId,
    field: 'itemId',
    label: 'Work-order item id',
    details,
  });

  completeValidation({
    request,
    section: 'params',
    value: { itemId },
    details,
    next,
  });
};
