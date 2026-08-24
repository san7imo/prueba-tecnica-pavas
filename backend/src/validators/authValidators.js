import { asObject, completeValidation, requiredString } from './validationUtils.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLogin = (request, _response, next) => {
  const body = asObject(request.body);
  const details = [];
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

  if (email && !EMAIL_PATTERN.test(email)) {
    details.push({ field: 'email', message: 'Email must be valid.' });
  }

  completeValidation({ request, section: 'body', value: { email, password }, details, next });
};
