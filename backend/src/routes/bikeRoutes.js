import { Router } from 'express';

import { USER_ROLE } from '../constants/auth.js';
import {
  changeBikeOwner,
  createBike,
  deleteBike,
  getBike,
  listBikes,
  restoreBike,
  updateBike,
} from '../controllers/bikeController.js';
import { authorize } from '../middlewares/authorize.js';
import {
  validateBikeList,
  validateBikeOwnerChange,
  validateBikeId,
  validateCreateBike,
  validateDeleteBike,
  validateRestoreBike,
  validateUpdateBike,
} from '../validators/bikeValidators.js';

export const bikeRouter = Router();

bikeRouter.post(
  '/',
  authorize(USER_ROLE.ADMIN),
  validateCreateBike,
  createBike,
);
bikeRouter.get('/', validateBikeList, listBikes);
bikeRouter.patch(
  '/:id/owner',
  authorize(USER_ROLE.ADMIN),
  validateBikeOwnerChange,
  changeBikeOwner,
);
bikeRouter.patch(
  '/:id',
  authorize(USER_ROLE.ADMIN),
  validateUpdateBike,
  updateBike,
);
bikeRouter.delete(
  '/:id',
  authorize(USER_ROLE.ADMIN),
  validateDeleteBike,
  deleteBike,
);
bikeRouter.post(
  '/:id/restore',
  authorize(USER_ROLE.ADMIN),
  validateRestoreBike,
  restoreBike,
);
bikeRouter.get('/:id', validateBikeId, getBike);
