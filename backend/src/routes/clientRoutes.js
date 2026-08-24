import { Router } from 'express';

import {
  createClient,
  getClient,
  listClients,
} from '../controllers/clientController.js';
import {
  validateClientId,
  validateClientSearch,
  validateCreateClient,
} from '../validators/clientValidators.js';

export const clientRouter = Router();

clientRouter.post('/', validateCreateClient, createClient);
clientRouter.get('/', validateClientSearch, listClients);
clientRouter.get('/:id', validateClientId, getClient);
