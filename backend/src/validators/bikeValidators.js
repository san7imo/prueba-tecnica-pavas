import { normalizePlate } from '../utils/normalizePlate.js';
import {
  asObject,
  completeValidation,
  optionalQueryString,
  positiveId,
  requiredString,
} from './validationUtils.js';

const normalizeCylinder = (value, details) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

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
    details.push({ field: 'cylinder', message: 'Cylinder must be at most 50 characters.' });
    return undefined;
  }

  return normalized || null;
};

export const validateCreateBike = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const rawPlate = requiredString({
    value: body.plate,
    field: 'plate',
    label: 'Plate',
    maxLength: 100,
    details,
  });
  const plate = rawPlate === undefined ? undefined : normalizePlate(rawPlate);

  if (plate !== undefined && (plate === '' || plate.length > 20)) {
    details.push({ field: 'plate', message: 'Normalized plate must contain at most 20 characters.' });
  }

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

export const validateBikeSearch = (request, _response, next) => {
  const details = [];
  const rawPlate = optionalQueryString({
    value: request.query.plate,
    field: 'plate',
    label: 'Plate',
    maxLength: 100,
    details,
  });
  const plate = rawPlate === undefined ? undefined : normalizePlate(rawPlate);

  if (plate !== undefined && plate.length > 20) {
    details.push({ field: 'plate', message: 'Normalized plate must contain at most 20 characters.' });
  }

  completeValidation({
    request,
    section: 'query',
    value: { plate },
    details,
    next,
  });
};

export const validateBikeId = (request, _response, next) => {
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Bike id',
    details,
  });

  completeValidation({
    request,
    section: 'params',
    value: { id },
    details,
    next,
  });
};
