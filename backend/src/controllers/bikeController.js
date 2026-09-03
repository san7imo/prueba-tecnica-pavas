import { bikeService } from '../services/bikeService.js';
import { serializeManagedBike } from '../utils/resourceSerializers.js';

export const createBike = async (request, response) => {
  const bike = await bikeService.createBike(
    request.validated.body,
    request.user,
  );
  response.status(201).json({ data: serializeManagedBike(bike) });
};

export const listBikes = async (request, response) => {
  const result = await bikeService.listBikes(
    request.validated.query,
    request.user,
  );
  response.json({
    data: result.bikes.map((bike) => serializeManagedBike(bike)),
    meta: result.meta,
  });
};

export const getBike = async (request, response) => {
  const result = await bikeService.getBike(
    request.validated.params.id,
    request.user,
  );
  response.json({
    data: serializeManagedBike(result.bike, {
      currentOpenOrder: result.currentOpenOrder,
    }),
  });
};

export const updateBike = async (request, response) => {
  const bike = await bikeService.updateBike(
    request.validated.params.id,
    request.validated.body.updates,
    request.user,
  );
  response.json({ data: serializeManagedBike(bike) });
};

export const changeBikeOwner = async (request, response) => {
  const bike = await bikeService.changeOwner(
    request.validated.params.id,
    request.validated.body,
    request.user,
  );
  response.json({ data: serializeManagedBike(bike) });
};

export const deleteBike = async (request, response) => {
  const bike = await bikeService.deleteBike(
    request.validated.params.id,
    request.validated.body.reason,
    request.user,
  );
  response.json({ data: serializeManagedBike(bike) });
};

export const restoreBike = async (request, response) => {
  const bike = await bikeService.restoreBike(
    request.validated.params.id,
    request.validated.body.reason,
    request.user,
  );
  response.json({ data: serializeManagedBike(bike) });
};
