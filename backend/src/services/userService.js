import { UniqueConstraintError } from 'sequelize';

import { sequelize } from '../config/databaseContext.js';
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants/audit.js';
import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { userRepository } from '../repositories/userRepository.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';

const userNotFound = () =>
  new NotFoundError({ code: 'USER_NOT_FOUND', message: 'User not found.' });

const emailConflict = () =>
  new ConflictError({
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists.',
  });

export const userService = {
  async createUser(data, actor) {
    const email = data.email.trim().toLowerCase();
    const passwordHash = await authService.hashPassword(data.password);

    try {
      const userId = await sequelize.transaction(async (transaction) => {
        const options = { transaction };
        if (await userRepository.findByEmail(email, options)) {
          throw emailConflict();
        }
        const user = await userRepository.create({
          name: data.name.trim(),
          email,
          passwordHash,
          role: data.role,
          active: true,
        }, options);
        await auditService.record({
          entityType: AUDIT_ENTITY_TYPE.USER,
          action: AUDIT_ACTION.CREATED,
          actor,
          after: user,
        }, transaction);
        return user.id;
      });
      return userRepository.findManagedById(userId);
    } catch (error) {
      if (error instanceof UniqueConstraintError) throw emailConflict();
      throw error;
    }
  },

  listUsers() {
    return userRepository.listManaged();
  },

  async changeRole(id, role) {
    if (!(await userRepository.findById(id))) throw userNotFound();
    await userRepository.updateRole(id, role);
    return userRepository.findManagedById(id);
  },

  async changeActive(id, active) {
    if (!(await userRepository.findById(id))) throw userNotFound();
    await userRepository.updateActive(id, active);
    return userRepository.findManagedById(id);
  },
};
