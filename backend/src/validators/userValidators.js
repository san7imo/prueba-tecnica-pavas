import { USER_ROLES } from '../constants/auth.js';
import {
  asObject,
  completeValidation,
  positiveId,
  requiredString,
} from './validationUtils.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRoleValue = (value, details) => {
  if (typeof value !== 'string' || !USER_ROLES.includes(value)) {
    details.push({ field: 'role', message: 'Role must be ADMIN or MECANICO.' });
    return undefined;
  }
  return value;
};

export const validateRegisterUser = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const name = requiredString({
    value: body.name,
    field: 'name',
    label: 'Name',
    maxLength: 150,
    details,
  });
  const rawEmail = requiredString({
    value: body.email,
    field: 'email',
    label: 'Email',
    maxLength: 254,
    details,
  });
  const password = requiredString({
    value: body.password,
    field: 'password',
    label: 'Password',
    maxLength: 200,
    details,
  });
  const email = rawEmail?.toLowerCase();
  const role = validateRoleValue(body.role, details);

  if (email && !EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Email must be valid.' });
  }
  if (password && password.length < 8) {
    details.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  }

  completeValidation({
    request,
    section: 'body',
    value: { name, email, password, role },
    details,
    next,
  });
};

export const validateUserId = (request, _response, next) => {
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'User id',
    details,
  });
  completeValidation({ request, section: 'params', value: { id }, details, next });
};

export const validateUserRole = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  const role = validateRoleValue(body.role, details);
  const reason = requiredString({
    value: body.reason,
    field: 'reason',
    label: 'Reason',
    maxLength: 1000,
    details,
  });
  completeValidation({
    request,
    section: 'body',
    value: { role, reason },
    details,
    next,
  });
};

export const validateUserActive = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
  let active;
  if (typeof body.active !== 'boolean') {
    details.push({ field: 'active', message: 'Active must be a boolean.' });
  } else {
    active = body.active;
  }
  const reason = requiredString({
    value: body.reason,
    field: 'reason',
    label: 'Reason',
    maxLength: 1000,
    details,
  });
  completeValidation({
    request,
    section: 'body',
    value: { active, reason },
    details,
    next,
  });
};
