import { AppError } from '../errors/AppError.js';

export const notFoundHandler = (_request, _response, next) => {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: 'Route was not found.',
      statusCode: 404,
    }),
  );
};
