import { validateAuthConfiguration } from './authConfig.js';
import { env } from './env.js';

const SUPPORTED_NODE_ENVS = new Set(['development', 'test', 'production']);

const validateFrontendOrigin = (value, nodeEnv) => {
  if (typeof value !== 'string' || value === '') {
    throw new Error('FRONTEND_ORIGIN must be configured.');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value) {
    throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin without path, query or fragment.');
  }

  if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
    throw new Error('FRONTEND_ORIGIN must use HTTPS in production.');
  }
};

export const validateApplicationConfiguration = (configuration = env) => {
  if (!SUPPORTED_NODE_ENVS.has(configuration.nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production.');
  }

  validateFrontendOrigin(configuration.frontendOrigin, configuration.nodeEnv);
  validateAuthConfiguration(configuration);
};
