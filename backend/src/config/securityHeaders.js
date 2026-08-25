import { env } from './env.js';

export const securityHeaderOptions = (configuration = env) => ({
  // This process serves JSON only. The frontend document host owns its CSP.
  contentSecurityPolicy: false,
  // A separately hosted frontend may read responses only after CORS approval.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: configuration.nodeEnv === 'production'
    ? { maxAge: 31536000, includeSubDomains: false, preload: false }
    : false,
});
