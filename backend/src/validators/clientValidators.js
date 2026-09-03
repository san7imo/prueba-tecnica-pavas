import {
  CLIENT_LIFECYCLE,
  CLIENT_LIFECYCLES,
} from '../constants/client.js';
import {
  isValidClientEmail,
  isValidClientPhone,
  normalizeClientEmail,
  normalizeClientPhone,
} from '../utils/clientContacts.js';
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

const clientPhone = (value, details) => {
  const rawPhone = requiredString({
    value,
    field: 'phone',
    label: 'Phone',
    maxLength: 100,
    details,
  });
  if (rawPhone === undefined) return undefined;
  const phone = normalizeClientPhone(rawPhone);
  if (!isValidClientPhone(phone)) {
    details.push({
      field: 'phone',
      message: 'Phone must contain 7 to 20 digits and may start with +.',
    });
    return undefined;
  }
  return phone;
};

const clientEmail = (value, details) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    details.push({ field: 'email', message: 'Email must be a string or null.' });
    return undefined;
  }
  const email = normalizeClientEmail(value);
  if (!isValidClientEmail(email)) {
    details.push({ field: 'email', message: 'Email must be valid.' });
    return undefined;
  }
  return email;
};

const optionalConfirmation = (value, details) => {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    details.push({
      field: 'confirmDuplicate',
      message: 'Confirm duplicate must be a boolean.',
    });
    return undefined;
  }
  return value;
};

const optionalReason = ({ value, field, label, required, details }) => {
  if (value === undefined || value === null) {
    if (required) details.push({ field, message: `${label} is required.` });
    return null;
  }
  if (typeof value !== 'string') {
    details.push({ field, message: `${label} must be a string.` });
    return undefined;
  }
  const reason = value.trim();
  if (required && reason === '') {
    details.push({ field, message: `${label} is required.` });
    return undefined;
  }
  if (reason.length > MAX_REASON_LENGTH) {
    details.push({
      field,
      message: `${label} must be at most ${MAX_REASON_LENGTH} characters.`,
    });
    return undefined;
  }
  return reason || null;
};

const duplicateControls = (body, details) => {
  const confirmDuplicate = optionalConfirmation(body.confirmDuplicate, details);
  const duplicateReason = optionalReason({
    value: body.duplicateReason,
    field: 'duplicateReason',
    label: 'Duplicate reason',
    required: confirmDuplicate === true,
    details,
  });
  if (confirmDuplicate === false && duplicateReason) {
    details.push({
      field: 'confirmDuplicate',
      message: 'Confirm duplicate must be true when duplicate reason is provided.',
    });
  }
  return { confirmDuplicate, duplicateReason };
};

const clientId = (request, details) =>
  positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Client id',
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

export const validateCreateClient = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const name = requiredString({
    value: body.name,
    field: 'name',
    label: 'Name',
    maxLength: 150,
    details,
  });
  const phone = clientPhone(body.phone, details);
  const email = clientEmail(body.email, details);
  const duplicate = duplicateControls(body, details);

  completeValidation({
    request,
    section: 'body',
    value: { name, phone, email, ...duplicate },
    details,
    next,
  });
};

export const validateClientList = (request, _response, next) => {
  const details = [];
  const search = optionalQueryString({
    value: request.query.search,
    field: 'search',
    label: 'Search',
    maxLength: 254,
    details,
  });
  const lifecycle =
    optionalQueryString({
      value: request.query.lifecycle,
      field: 'lifecycle',
      label: 'Lifecycle',
      maxLength: 20,
      details,
    }) ?? CLIENT_LIFECYCLE.ACTIVE;
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
  if (!CLIENT_LIFECYCLES.includes(lifecycle)) {
    details.push({
      field: 'lifecycle',
      message: 'Lifecycle must be active, deleted or all.',
    });
  }

  completeValidation({
    request,
    section: 'query',
    value: { search, lifecycle, page, pageSize },
    details,
    next,
  });
};

export const validateClientId = (request, _response, next) => {
  const details = [];
  const id = clientId(request, details);
  completeValidation({
    request,
    section: 'params',
    value: { id },
    details,
    next,
  });
};

export const validateUpdateClient = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = clientId(request, details);
  const updates = {};

  if (hasOwn(body, 'name')) {
    updates.name = requiredString({
      value: body.name,
      field: 'name',
      label: 'Name',
      maxLength: 150,
      details,
    });
  }
  if (hasOwn(body, 'phone')) updates.phone = clientPhone(body.phone, details);
  if (hasOwn(body, 'email')) updates.email = clientEmail(body.email, details);
  if (!['name', 'phone', 'email'].some((field) => hasOwn(body, field))) {
    details.push({
      field: 'body',
      message: 'At least one client field must be provided.',
    });
  }
  const duplicate = duplicateControls(body, details);

  completeParamsAndBody({
    request,
    params: { id },
    body: { updates, ...duplicate },
    details,
    next,
  });
};

export const validateDeleteClient = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = clientId(request, details);
  const reason = optionalReason({
    value: body.reason,
    field: 'reason',
    label: 'Reason',
    required: true,
    details,
  });
  completeParamsAndBody({
    request,
    params: { id },
    body: { reason },
    details,
    next,
  });
};

export const validateRestoreClient = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = clientId(request, details);
  const reason = optionalReason({
    value: body.reason,
    field: 'reason',
    label: 'Reason',
    required: true,
    details,
  });
  const duplicate = duplicateControls(body, details);
  completeParamsAndBody({
    request,
    params: { id },
    body: { reason, ...duplicate },
    details,
    next,
  });
};
