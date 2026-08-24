import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import { login, logout, me, refresh } from '../controllers/authController.js';
import { registerUser } from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { createLoginRateLimiter } from '../middlewares/loginRateLimiter.js';
import { validateLogin } from '../validators/authValidators.js';
import { validateRegisterUser } from '../validators/userValidators.js';

export const authRouter = Router();

authRouter.post('/login', createLoginRateLimiter(), validateLogin, login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
authRouter.post(
  '/register',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  validateRegisterUser,
  registerUser,
);
