import bcrypt from 'bcrypt';
import supertest from 'supertest';

import { models } from '../../src/config/databaseContext.js';
import { env } from '../../src/config/env.js';
import { issueAccessToken } from '../../src/utils/authTokens.js';

const HTTP_METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put']);

export const createTestIdentity = async ({ name, email, role, active = true }) => {
  const user = await models.User.create({
    name,
    email,
    passwordHash: await bcrypt.hash('Integration-test-password-123', env.auth.bcryptRounds),
    role,
    active,
  });
  return { user, accessToken: issueAccessToken(user) };
};

export const createAuthenticatedRequest = (getAccessToken) => (app) => {
  const client = supertest(app);
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (!HTTP_METHODS.has(property)) {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (...args) =>
        value.apply(target, args).set('Authorization', `Bearer ${getAccessToken()}`);
    },
  });
};
