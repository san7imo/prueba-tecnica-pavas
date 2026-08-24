import { Router } from 'express';

import { createBike, getBike, listBikes } from '../controllers/bikeController.js';
import {
  validateBikeId,
  validateBikeSearch,
  validateCreateBike,
} from '../validators/bikeValidators.js';

export const bikeRouter = Router();

bikeRouter.post('/', validateCreateBike, createBike);
bikeRouter.get('/', validateBikeSearch, listBikes);
bikeRouter.get('/:id', validateBikeId, getBike);
