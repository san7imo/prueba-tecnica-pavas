import {
  WORK_ORDER_STATUSES,
} from '../constants/workOrder.js';
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
const MAX_STATUS_NOTE_LENGTH = 1000;
const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

const parseEntryDate = (value, details) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    details.push({ field: 'entryDate', message: 'Entry date must be an ISO 8601 string.' });
    return undefined;
  }

  const normalized = value.trim();
  const match = ISO_DATE_TIME_PATTERN.exec(normalized);
  const timestamp = Date.parse(normalized);

  if (!match || Number.isNaN(timestamp)) {
    details.push({ field: 'entryDate', message: 'Entry date must be a valid ISO 8601 date-time.' });
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    details.push({ field: 'entryDate', message: 'Entry date must be a valid ISO 8601 date-time.' });
    return undefined;
  }

  return new Date(timestamp);
};

const paginationInteger = ({ value, field, defaultValue, max, details }) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

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

const optionalStatusNote = (value, details) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    details.push({ field: 'note', message: 'Note must be a string or null.' });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > MAX_STATUS_NOTE_LENGTH) {
    details.push({
      field: 'note',
      message: `Note must be at most ${MAX_STATUS_NOTE_LENGTH} characters.`,
    });
    return undefined;
  }

  return normalized || null;
};

export const validateCreateWorkOrder = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const bikeId = positiveId({
    value: body.bikeId,
    field: 'bikeId',
    label: 'Bike id',
    details,
  });
  const faultDescription = requiredString({
    value: body.faultDescription,
    field: 'faultDescription',
    label: 'Fault description',
    maxLength: 10000,
    details,
  });
  const entryDate = parseEntryDate(body.entryDate, details);

  completeValidation({
    request,
    section: 'body',
    value: { bikeId, faultDescription, entryDate },
    details,
    next,
  });
};

export const validateWorkOrderList = (request, _response, next) => {
  const details = [];
  const rawStatus = optionalQueryString({
    value: request.query.status,
    field: 'status',
    label: 'Status',
    maxLength: 30,
    details,
  });
  const rawPlate = optionalQueryString({
    value: request.query.plate,
    field: 'plate',
    label: 'Plate',
    maxLength: 100,
    details,
  });
  const plate = rawPlate === undefined ? undefined : normalizePlate(rawPlate);

  if (rawStatus !== undefined && !WORK_ORDER_STATUSES.includes(rawStatus)) {
    details.push({ field: 'status', message: 'Status must be a contractual work-order status.' });
  }
  if (plate !== undefined && plate.length > 20) {
    details.push({ field: 'plate', message: 'Normalized plate must contain at most 20 characters.' });
  }

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

  completeValidation({
    request,
    section: 'query',
    value: { status: rawStatus, plate, page, pageSize },
    details,
    next,
  });
};

export const validateWorkOrderId = (request, _response, next) => {
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Work order id',
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

export const validateWorkOrderStatusUpdate = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Work order id',
    details,
  });
  const toStatus = requiredString({
    value: body.toStatus,
    field: 'toStatus',
    label: 'Target status',
    maxLength: 30,
    details,
  });
  const note = optionalStatusNote(body.note, details);

  if (toStatus !== undefined && !WORK_ORDER_STATUSES.includes(toStatus)) {
    details.push({
      field: 'toStatus',
      message: 'Target status must be a contractual work-order status.',
    });
  }

  if (details.length > 0) {
    completeValidation({ request, section: 'body', value: {}, details, next });
    return;
  }

  request.validated = {
    params: { id },
    body: { toStatus, note },
  };
  next();
};
