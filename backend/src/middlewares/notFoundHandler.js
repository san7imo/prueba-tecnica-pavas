import { AppError } from '../errors/AppError.js';

export const notFoundHandler = (request, _response, next) => {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.originalUrl} was not found.`,
      statusCode: 404,
    }),
  );
};

