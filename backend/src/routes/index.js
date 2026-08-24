import { Router } from 'express';

import { bikeRouter } from './bikeRoutes.js';
import { clientRouter } from './clientRoutes.js';
import { healthRouter } from './healthRoutes.js';
import { workOrderRouter } from './workOrderRoutes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/clients', clientRouter);
apiRouter.use('/bikes', bikeRouter);
apiRouter.use('/work-orders', workOrderRouter);
