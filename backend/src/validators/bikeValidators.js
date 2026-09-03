import { BIKE_LIFECYCLE, BIKE_LIFECYCLES } from '../constants/bike.js';
import { BusinessRuleError } from '../errors/BusinessRuleError.js';
import { normalizePlate } from '../utils/normalizePlate.js';
import {
  asObject,
  completeValidation,
  optionalQueryString,
  positiveId,
  requiredString,
} from './validationUtils.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_REASON_LENGTH = 1000;
const hasOwn = (object, field) =>
  Object.prototype.hasOwnProperty.call(object, field);

const normalizedPlate = ({ value, field, label, required, details }) => {
  const rawPlate = required
    ? requiredString({ value, field, label, maxLength: 100, details })
    : optionalQueryString({ value, field, label, maxLength: 100, details });
  if (rawPlate === undefined) return undefined;
  const plate = normalizePlate(rawPlate);
  if (plate === '' || plate.length > 20) {
    details.push({
      field,
      message: `${label} must normalize to between 1 and 20 characters.`,
    });
    return undefined;
  }
  return plate;
};

const normalizeCylinder = (value, details) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    details.push({ field: 'cylinder', message: 'Cylinder must be a string or number.' });
    return undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    details.push({ field: 'cylinder', message: 'Cylinder must be finite.' });
    return undefined;
  }
  const normalized = String(value).trim();
  if (normalized.length > 50) {
    details.push({
      field: 'cylinder',
      message: 'Cylinder must be at most 50 characters.',
    });
    return undefined;
  }
  return normalized || null;
};

const paginationInteger = ({ value, field, defaultValue, max, details }) => {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    details.push({ field, message: `${field} must be a positive integer.` });
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    details.push({ field, message: `${field} is outside the supported range.` });
    return undefined;
  }
  if (max !== undefined && parsed > max) {
    details.push({ field, message: `${field} must be at most ${max}.` });
    return undefined;
  }
  return parsed;
};

const requiredReason = (value, details) =>
  requiredString({
    value,
    field: 'reason',
    label: 'Reason',
    maxLength: MAX_REASON_LENGTH,
    details,
  });

const bikeId = (request, details) =>
  positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Bike id',
    details,
  });

const completeParamsAndBody = ({ request, params, body, details, next }) => {
  if (details.length > 0) {
    completeValidation({ request, section: 'body', value: {}, details, next });
    return;
  }
  request.validated = { params, body };
  next();
};

export const validateCreateBike = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const plate = normalizedPlate({
    value: body.plate,
    field: 'plate',
    label: 'Plate',
    required: true,
    details,
  });
  const brand = requiredString({
    value: body.brand,
    field: 'brand',
    label: 'Brand',
    maxLength: 100,
    details,
  });
  const model = requiredString({
    value: body.model,
    field: 'model',
    label: 'Model',
    maxLength: 100,
    details,
  });
  const cylinder = normalizeCylinder(body.cylinder, details);
  const clientId = positiveId({
    value: body.clientId,
    field: 'clientId',
    label: 'Client id',
    details,
  });

  completeValidation({
    request,
    section: 'body',
    value: { plate, brand, model, cylinder, clientId },
    details,
    next,
  });
};

export const validateBikeList = (request, _response, next) => {
  const details = [];
  const plate = normalizedPlate({
    value: request.query.plate,
    field: 'plate',
    label: 'Plate',
    required: false,
    details,
  });
  const platePrefix = normalizedPlate({
    value: request.query.platePrefix,
    field: 'platePrefix',
    label: 'Plate prefix',
    required: false,
    details,
  });
  const lifecycle = optionalQueryString({
    value: request.query.lifecycle,
    field: 'lifecycle',
    label: 'Lifecycle',
    maxLength: 20,
    details,
  }) ?? BIKE_LIFECYCLE.ACTIVE;
  const clientId =
    request.query.clientId === undefined || request.query.clientId === ''
      ? undefined
      : positiveId({
          value: request.query.clientId,
          field: 'clientId',
          label: 'Client id',
          details,
        });
  const page = paginationInteger({
    value: request.query.page,
    field: 'page',
    defaultValue: DEFAULT_PAGE,
    details,
  });
  const pageSize = paginationInteger({
    value: request.query.pageSize,
    field: 'pageSize',
    defaultValue: DEFAULT_PAGE_SIZE,
    max: MAX_PAGE_SIZE,
    details,
  });

  if (!BIKE_LIFECYCLES.includes(lifecycle)) {
    details.push({
      field: 'lifecycle',
      message: 'Lifecycle must be active, deleted or all.',
    });
  }
  if (details.length === 0 && plate !== undefined && platePrefix !== undefined) {
    next(new BusinessRuleError({
      code: 'INVALID_QUERY_FILTERS',
      message: 'Plate and platePrefix cannot be used together.',
    }));
    return;
  }

  completeValidation({
    request,
    section: 'query',
    value: { plate, platePrefix, clientId, lifecycle, page, pageSize },
    details,
    next,
  });
};

export const validateBikeId = (request, _response, next) => {
  const details = [];
  const id = bikeId(request, details);
  completeValidation({
    request,
    section: 'params',
    value: { id },
    details,
    next,
  });
};

export const validateUpdateBike = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = bikeId(request, details);
  const updates = {};

  if (hasOwn(body, 'plate')) {
    updates.plate = normalizedPlate({
      value: body.plate,
      field: 'plate',
      label: 'Plate',
      required: true,
      details,
    });
  }
  if (hasOwn(body, 'brand')) {
    updates.brand = requiredString({
      value: body.brand,
      field: 'brand',
      label: 'Brand',
      maxLength: 100,
      details,
    });
  }
  if (hasOwn(body, 'model')) {
    updates.model = requiredString({
      value: body.model,
      field: 'model',
      label: 'Model',
      maxLength: 100,
      details,
    });
  }
  if (hasOwn(body, 'cylinder')) {
    updates.cylinder = normalizeCylinder(body.cylinder, details);
  }
  if (!['plate', 'brand', 'model', 'cylinder'].some((field) => hasOwn(body, field))) {
    details.push({
      field: 'body',
      message: 'At least one motorcycle field must be provided.',
    });
  }

  completeParamsAndBody({
    request,
    params: { id },
    body: { updates },
    details,
    next,
  });
};

export const validateBikeOwnerChange = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = bikeId(request, details);
  const clientId = positiveId({
    value: body.clientId,
    field: 'clientId',
    label: 'Client id',
    details,
  });
  const reason = requiredReason(body.reason, details);
  completeParamsAndBody({
    request,
    params: { id },
    body: { clientId, reason },
    details,
    next,
  });
};

const validateLifecycleMutation = (request, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = bikeId(request, details);
  const reason = requiredReason(body.reason, details);
  completeParamsAndBody({
    request,
    params: { id },
    body: { reason },
    details,
    next,
  });
};

export const validateDeleteBike = (request, _response, next) =>
  validateLifecycleMutation(request, next);

export const validateRestoreBike = (request, _response, next) =>
  validateLifecycleMutation(request, next);
