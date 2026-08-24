import {
  asObject,
  completeValidation,
  optionalQueryString,
  positiveId,
  requiredString,
} from './validationUtils.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const phone = requiredString({
    value: body.phone,
    field: 'phone',
    label: 'Phone',
    maxLength: 30,
    details,
  });

  let email = null;
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string') {
      details.push({ field: 'email', message: 'Email must be a string.' });
    } else {
      email = body.email.trim().toLowerCase();
      if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
        details.push({ field: 'email', message: 'Email must be valid.' });
      }
    }
  }

  completeValidation({
    request,
    section: 'body',
    value: { name, phone, email },
    details,
    next,
  });
};

export const validateClientSearch = (request, _response, next) => {
  const details = [];
  const search = optionalQueryString({
    value: request.query.search,
    field: 'search',
    label: 'Search',
    maxLength: 254,
    details,
  });

  completeValidation({
    request,
    section: 'query',
    value: { search },
    details,
    next,
  });
};

export const validateClientId = (request, _response, next) => {
  const details = [];
  const id = positiveId({
    value: request.params.id,
    field: 'id',
    label: 'Client id',
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
