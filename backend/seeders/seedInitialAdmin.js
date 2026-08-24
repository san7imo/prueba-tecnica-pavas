import bcrypt from 'bcrypt';

import { USER_ROLE } from '../src/constants/auth.js';
import { env } from '../src/config/env.js';
import { userRepository } from '../src/repositories/userRepository.js';

const normalizeSeed = (configuration) => {
  const name = configuration.name.trim();
  const email = configuration.email.trim().toLowerCase();
  const password = configuration.password;

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new Error(
      'ADMIN_SEED_NAME, a valid ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD of at least 12 characters are required.',
    );
  }
  return { name, email, password };
};

export const seedInitialAdmin = async (configuration = env.adminSeed) => {
  const seed = normalizeSeed(configuration);
  const existing = await userRepository.findByEmail(seed.email);

  if (existing) {
    if (existing.role !== USER_ROLE.ADMIN) {
      throw new Error('ADMIN_SEED_EMAIL already belongs to a non-ADMIN user.');
    }
    return { created: false, user: existing };
  }

  const passwordHash = await bcrypt.hash(seed.password, env.auth.bcryptRounds);
  const user = await userRepository.create({
    name: seed.name,
    email: seed.email,
    passwordHash,
    role: USER_ROLE.ADMIN,
    active: true,
  });
  return { created: true, user };
};
