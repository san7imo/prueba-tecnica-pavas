import { AppError } from '../errors/AppError.js';

export const errorHandler = (error, _request, response, _next) => {
  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;
  const payload = {
    error: {
      code: isOperational ? error.code : 'INTERNAL_ERROR',
      message: isOperational ? error.message : 'An unexpected error occurred.',
    },
  };

  if (isOperational && error.details !== undefined) {
    payload.error.details = error.details;
  }

  response.status(statusCode).json(payload);
};

