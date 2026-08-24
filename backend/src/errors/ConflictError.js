import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  constructor({ code, message }) {
    super({ code, message, statusCode: 409 });
    this.name = 'ConflictError';
  }
}
