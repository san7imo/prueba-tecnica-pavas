import { Router } from 'express';

import { USER_ROLES } from '../constants/auth.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { authRouter } from './authRoutes.js';
import { bikeRouter } from './bikeRoutes.js';
import { clientRouter } from './clientRoutes.js';
import { healthRouter } from './healthRoutes.js';
import { workOrderRouter } from './workOrderRoutes.js';
import { userRouter } from './userRoutes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/clients', authenticate, authorize(...USER_ROLES), clientRouter);
apiRouter.use('/bikes', authenticate, authorize(...USER_ROLES), bikeRouter);
apiRouter.use(
  '/work-orders',
  authenticate,
  authorize(...USER_ROLES),
  workOrderRouter,
);
