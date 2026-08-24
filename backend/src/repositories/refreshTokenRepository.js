import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

export const refreshTokenRepository = {
  create(data, { transaction } = {}) {
    return models.RefreshToken.create(data, {
      fields: ['userId', 'familyId', 'tokenHash', 'expiresAt'],
      transaction,
    });
  },

  findByHashForUpdate(tokenHash, transaction) {
    return models.RefreshToken.findOne({
      where: { tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  async markRotated(token, replacementId, revokedAt, transaction) {
    token.revokedAt = revokedAt;
    token.replacedByTokenId = replacementId;
    await token.save({ fields: ['revokedAt', 'replacedByTokenId'], transaction });
  },

  async revokeCurrent(token, revokedAt, transaction) {
    if (token.revokedAt === null) {
      token.revokedAt = revokedAt;
      await token.save({ fields: ['revokedAt'], transaction });
    }
  },

  revokeFamily(familyId, revokedAt, transaction) {
    return models.RefreshToken.update(
      { revokedAt },
      { where: { familyId, revokedAt: { [Op.is]: null } }, transaction },
    );
  },
};
