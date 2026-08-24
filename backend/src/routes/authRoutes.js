import { Router } from 'express';

import { login, logout, me, refresh } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { createLoginRateLimiter } from '../middlewares/loginRateLimiter.js';
import { validateLogin } from '../validators/authValidators.js';

export const authRouter = Router();

authRouter.post('/login', createLoginRateLimiter(), validateLogin, login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
