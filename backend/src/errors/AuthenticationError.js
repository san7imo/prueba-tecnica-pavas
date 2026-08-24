import { AppError } from './AppError.js';

export class AuthenticationError extends AppError {
  constructor({ code, message }) {
    super({ code, message, statusCode: 401 });
    this.name = 'AuthenticationError';
  }
}
