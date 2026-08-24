import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';

export const createLoginRateLimiter = (overrides = {}) =>
  rateLimit({
    windowMs: env.auth.loginRateLimitWindowMs,
    limit: env.auth.loginRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many login attempts. Try again later.',
        },
      });
    },
    ...overrides,
  });
