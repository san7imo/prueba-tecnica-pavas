import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  constructor(details) {
    super({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      statusCode: 400,
      details,
    });
    this.name = 'ValidationError';
  }
}
