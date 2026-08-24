import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor({ code, message }) {
    super({ code, message, statusCode: 404 });
    this.name = 'NotFoundError';
  }
}
