import { AuthenticationError } from '../errors/AuthenticationError.js';
import { userRepository } from '../repositories/userRepository.js';
import { verifyAccessToken } from '../utils/authTokens.js';
import { serializeUser } from '../utils/resourceSerializers.js';

const requiredError = () =>
  new AuthenticationError({
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required.',
  });

const invalidError = () =>
  new AuthenticationError({
    code: 'INVALID_ACCESS_TOKEN',
    message: 'The access token is invalid or expired.',
  });

export const authenticate = async (request, _response, next) => {
  const header = request.headers.authorization;
  if (header === undefined) {
    next(requiredError());
    return;
  }

  const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null;
  if (!match) {
    next(invalidError());
    return;
  }

  try {
    const claims = verifyAccessToken(match[1]);
    if (typeof claims !== 'object' || !/^[1-9]\d*$/.test(claims.sub ?? '')) {
      next(invalidError());
      return;
    }

    const user = await userRepository.findById(claims.sub);
    if (!user || !user.active || claims.role !== user.role) {
      next(invalidError());
      return;
    }

    request.user = serializeUser(user);
    next();
  } catch {
    next(invalidError());
  }
};
