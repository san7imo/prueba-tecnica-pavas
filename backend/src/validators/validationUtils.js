import { ValidationError } from '../errors/ValidationError.js';

const MAX_UNSIGNED_BIGINT = 18446744073709551615n;

export const asObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const requiredString = ({ value, field, label, maxLength, details }) => {
  if (typeof value !== 'string' || value.trim() === '') {
    details.push({ field, message: `${label} is required.` });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    details.push({ field, message: `${label} must be at most ${maxLength} characters.` });
    return undefined;
  }

  return normalized;
};

export const optionalQueryString = ({ value, field, label, maxLength, details }) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    details.push({ field, message: `${label} must be a string.` });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    details.push({ field, message: `${label} must be at most ${maxLength} characters.` });
    return undefined;
  }

  return normalized || undefined;
};

export const positiveId = ({ value, field, label, details }) => {
  const stringValue = typeof value === 'number' ? String(value) : value;

  if (typeof stringValue !== 'string' || !/^[1-9]\d{0,19}$/.test(stringValue)) {
    details.push({ field, message: `${label} must be a positive integer.` });
    return undefined;
  }

  if (BigInt(stringValue) > MAX_UNSIGNED_BIGINT) {
    details.push({ field, message: `${label} is outside the supported range.` });
    return undefined;
  }

  return stringValue;
};

export const completeValidation = ({ request, section, value, details, next }) => {
  if (details.length > 0) {
    next(new ValidationError(details));
    return;
  }

  request.validated = {
    ...(request.validated ?? {}),
    [section]: value,
  };
  next();
};
