import { AppError } from './AppError.js';

export class ConflictError extends AppError {
  constructor({ code, message, details }) {
    super({ code, message, statusCode: 409, details });
    this.name = 'ConflictError';
  }
}
