import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import {
  changeUserActive,
  changeUserRole,
  listUsers,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  validateUserActive,
  validateUserId,
  validateUserRole,
} from '../validators/userValidators.js';

export const userRouter = Router();

userRouter.use(authenticate, authorize(USER_ROLE.ADMIN));
userRouter.get('/', listUsers);
userRouter.patch('/:id/role', validateUserId, validateUserRole, changeUserRole);
userRouter.patch('/:id/active', validateUserId, validateUserActive, changeUserActive);
