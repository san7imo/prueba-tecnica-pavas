import bcrypt from 'bcrypt';

import { sequelize } from '../config/databaseContext.js';
import { env } from '../config/env.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  digestRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  newTokenFamilyId,
  verifyRefreshToken,
} from '../utils/authTokens.js';
import { serializeUser } from '../utils/resourceSerializers.js';

const invalidCredentials = () =>
  new AuthenticationError({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
  });

const invalidRefresh = () =>
  new AuthenticationError({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'The refresh token is invalid or expired.',
  });

const createRefreshRecord = async ({ userId, familyId, transaction }) => {
  const issued = issueRefreshToken({ userId, familyId });
  const record = await refreshTokenRepository.create(
    {
      userId,
      familyId,
      tokenHash: digestRefreshToken(issued.token),
      expiresAt: issued.expiresAt,
    },
    { transaction },
  );
  return { ...issued, record };
};

export const authService = {
  async login({ email, password }) {
    const user = await userRepository.findForAuthentication(email);
    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !user.active || !validPassword) throw invalidCredentials();

    const refresh = await createRefreshRecord({
      userId: user.id,
      familyId: newTokenFamilyId(),
    });

    return {
      accessToken: issueAccessToken(user),
      refreshToken: refresh.token,
      user: serializeUser(user),
    };
  },

  async refresh(rawToken) {
    if (!rawToken) throw invalidRefresh();

    let claims;
    try {
      claims = verifyRefreshToken(rawToken);
    } catch {
      throw invalidRefresh();
    }

    if (
      typeof claims !== 'object' ||
      claims.type !== 'refresh' ||
      typeof claims.familyId !== 'string' ||
      !/^[1-9]\d*$/.test(claims.sub ?? '')
    ) {
      throw invalidRefresh();
    }

    const tokenHash = digestRefreshToken(rawToken);
    const now = new Date();
    const outcome = await sequelize.transaction(async (transaction) => {
      const current = await refreshTokenRepository.findByHashForUpdate(tokenHash, transaction);
      if (!current) return { invalid: true };

      if (current.revokedAt !== null) {
        if (current.replacedByTokenId !== null) {
          await refreshTokenRepository.revokeFamily(current.familyId, now, transaction);
        }
        return { invalid: true };
      }

      if (
        current.expiresAt <= now ||
        String(current.userId) !== claims.sub ||
        current.familyId !== claims.familyId
      ) {
        return { invalid: true };
      }

      const user = await userRepository.findById(current.userId, { transaction });
      if (!user || !user.active) return { invalid: true };

      const replacement = await createRefreshRecord({
        userId: user.id,
        familyId: current.familyId,
        transaction,
      });
      await refreshTokenRepository.markRotated(
        current,
        replacement.record.id,
        now,
        transaction,
      );

      return { user, refreshToken: replacement.token };
    });

    if (outcome.invalid) throw invalidRefresh();

    return {
      accessToken: issueAccessToken(outcome.user),
      refreshToken: outcome.refreshToken,
      user: serializeUser(outcome.user),
    };
  },

  async logout(rawToken) {
    if (!rawToken) return;
    const tokenHash = digestRefreshToken(rawToken);

    await sequelize.transaction(async (transaction) => {
      const token = await refreshTokenRepository.findByHashForUpdate(tokenHash, transaction);
      if (token) await refreshTokenRepository.revokeCurrent(token, new Date(), transaction);
    });
  },

  hashPassword(password) {
    return bcrypt.hash(password, env.auth.bcryptRounds);
  },
};
