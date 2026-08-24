import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const JWT_ALGORITHM = 'HS256';

export const digestRefreshToken = (token) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const issueAccessToken = (user) =>
  jwt.sign({ role: user.role }, env.auth.accessSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.auth.accessExpiresIn,
    subject: String(user.id),
  });

export const issueRefreshToken = ({ userId, familyId }) => {
  const token = jwt.sign(
    { familyId, type: 'refresh' },
    env.auth.refreshSecret,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: env.auth.refreshExpiresIn,
      subject: String(userId),
      jwtid: randomUUID(),
    },
  );
  const claims = jwt.decode(token);
  return { token, expiresAt: new Date(claims.exp * 1000) };
};

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.auth.accessSecret, { algorithms: [JWT_ALGORITHM] });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, env.auth.refreshSecret, { algorithms: [JWT_ALGORITHM] });

export const newTokenFamilyId = () => randomUUID();
