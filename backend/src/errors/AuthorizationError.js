import { AppError } from './AppError.js';

export class AuthorizationError extends AppError {
  constructor({
    code = 'FORBIDDEN',
    message = 'You do not have permission to perform this action.',
  } = {}) {
    super({
      code,
      message,
      statusCode: 403,
    });
    this.name = 'AuthorizationError';
  }
}
