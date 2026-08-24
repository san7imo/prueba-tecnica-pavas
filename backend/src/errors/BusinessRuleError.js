import { AppError } from './AppError.js';

export class BusinessRuleError extends AppError {
  constructor({ code, message }) {
    super({ code, message, statusCode: 400 });
    this.name = 'BusinessRuleError';
  }
}
