import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const deniedOriginError = () =>
  new AppError({
    code: 'CORS_ORIGIN_DENIED',
    message: 'Origin is not allowed by the CORS policy.',
    statusCode: 403,
  });

export const corsOptions = {
  origin(origin, callback) {
    if (origin === undefined || origin === env.frontendOrigin) {
      callback(null, true);
      return;
    }
    callback(deniedOriginError());
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
  optionsSuccessStatus: 204,
};
