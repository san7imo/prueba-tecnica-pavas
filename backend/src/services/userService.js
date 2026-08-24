import { UniqueConstraintError } from 'sequelize';

import { ConflictError } from '../errors/ConflictError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { userRepository } from '../repositories/userRepository.js';
import { authService } from './authService.js';

const userNotFound = () =>
  new NotFoundError({ code: 'USER_NOT_FOUND', message: 'User not found.' });

const emailConflict = () =>
  new ConflictError({
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists.',
  });

export const userService = {
  async createUser(data) {
    const email = data.email.trim().toLowerCase();
    if (await userRepository.findByEmail(email)) throw emailConflict();

    try {
      const user = await userRepository.create({
        name: data.name.trim(),
        email,
        passwordHash: await authService.hashPassword(data.password),
        role: data.role,
        active: true,
      });
      return userRepository.findManagedById(user.id);
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
