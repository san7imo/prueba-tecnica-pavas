import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../constants/audit.js';
import {
  completeValidation,
  optionalQueryString,
  positiveId,
} from './validationUtils.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

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

const optionalId = ({ value, field, label, details }) =>
  value === undefined || value === ''
    ? undefined
    : positiveId({ value, field, label, details });

const optionalDate = ({ value, field, label, details }) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !ISO_DATE_TIME_PATTERN.test(value.trim())) {
    details.push({ field, message: `${label} must be a valid ISO 8601 date-time.` });
    return undefined;
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${label} must be a valid ISO 8601 date-time.` });
    return undefined;
  }
  const match = ISO_DATE_TIME_PATTERN.exec(value.trim());
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    details.push({ field, message: `${label} must be a valid ISO 8601 date-time.` });
    return undefined;
  }
  return date;
};

export const validateAuditEventList = (request, _response, next) => {
  const details = [];
  const entityType = optionalQueryString({
    value: request.query.entityType,
    field: 'entityType',
    label: 'Entity type',
    maxLength: 30,
    details,
  });
  const action = optionalQueryString({
    value: request.query.action,
    field: 'action',
    label: 'Action',
    maxLength: 30,
    details,
  });
  const entityId = optionalId({
    value: request.query.entityId,
    field: 'entityId',
    label: 'Entity id',
    details,
  });
  const actorUserId = optionalId({
    value: request.query.actorUserId,
    field: 'actorUserId',
    label: 'Actor user id',
    details,
  });
  const dateFrom = optionalDate({
    value: request.query.dateFrom,
    field: 'dateFrom',
    label: 'Date from',
    details,
  });
  const dateTo = optionalDate({
    value: request.query.dateTo,
    field: 'dateTo',
    label: 'Date to',
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

  if (entityType && !AUDIT_ENTITY_TYPES.includes(entityType)) {
    details.push({ field: 'entityType', message: 'Entity type is not supported.' });
  }
  if (action && !AUDIT_ACTIONS.includes(action)) {
    details.push({ field: 'action', message: 'Action is not supported.' });
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    details.push({ field: 'dateTo', message: 'Date to must not be before date from.' });
  }

  completeValidation({
    request,
    section: 'query',
    value: {
      entityType,
      entityId,
      action,
      actorUserId,
      dateFrom,
      dateTo,
      page,
      pageSize,
    },
    details,
    next,
  });
};

export const validateAuditEventId = (request, _response, next) => {
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Audit event id',
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
