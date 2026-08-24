import { AppError } from './AppError.js';

export class AuthorizationError extends AppError {
  constructor() {
    super({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
      statusCode: 403,
    });
    this.name = 'AuthorizationError';
  }
}
