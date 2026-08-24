import { AuthenticationError } from '../errors/AuthenticationError.js';
import { AuthorizationError } from '../errors/AuthorizationError.js';

export const authorize = (...roles) => (request, _response, next) => {
  if (!request.user) {
    next(
      new AuthenticationError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required.',
      }),
    );
    return;
  }

  if (!roles.includes(request.user.role)) {
    next(new AuthorizationError());
    return;
  }

  next();
};
