import { AppError } from '../errors/AppError.js';

export const errorHandler = (error, _request, response, _next) => {
  const isOperational = error instanceof AppError;
  const isMalformedJson = error?.type === 'entity.parse.failed';
  const isOversizedBody = error?.type === 'entity.too.large';
  const statusCode = isOperational
    ? error.statusCode
    : isMalformedJson
      ? 400
      : isOversizedBody
        ? 413
        : 500;
  const payload = {
    error: {
      code: isOperational
        ? error.code
        : isMalformedJson
          ? 'INVALID_JSON'
          : isOversizedBody
            ? 'PAYLOAD_TOO_LARGE'
            : 'INTERNAL_ERROR',
      message: isOperational
        ? error.message
        : isMalformedJson
          ? 'Request body contains invalid JSON.'
          : isOversizedBody
            ? 'Request body exceeds the allowed size.'
            : 'An unexpected error occurred.',
    },
  };

  if (isOperational && error.details !== undefined) {
    payload.error.details = error.details;
  }

  response.status(statusCode).json(payload);
};
