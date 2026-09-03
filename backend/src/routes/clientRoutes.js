import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  restoreClient,
  updateClient,
} from '../controllers/clientController.js';
import { authorize } from '../middlewares/authorize.js';
import {
  validateClientList,
  validateClientId,
  validateCreateClient,
  validateDeleteClient,
  validateRestoreClient,
  validateUpdateClient,
} from '../validators/clientValidators.js';

export const clientRouter = Router();

clientRouter.post(
  '/',
  authorize(USER_ROLE.ADMIN),
  validateCreateClient,
  createClient,
);
clientRouter.get('/', validateClientList, listClients);
clientRouter.patch(
  '/:id',
  authorize(USER_ROLE.ADMIN),
  validateUpdateClient,
  updateClient,
);
clientRouter.delete(
  '/:id',
  authorize(USER_ROLE.ADMIN),
  validateDeleteClient,
  deleteClient,
);
clientRouter.post(
  '/:id/restore',
  authorize(USER_ROLE.ADMIN),
  validateRestoreClient,
  restoreClient,
);
clientRouter.get('/:id', validateClientId, getClient);
