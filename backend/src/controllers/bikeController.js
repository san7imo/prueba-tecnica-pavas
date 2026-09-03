import { bikeService } from '../services/bikeService.js';
import { serializeBike } from '../utils/resourceSerializers.js';

export const createBike = async (request, response) => {
  const bike = await bikeService.createBike(
    request.validated.body,
    request.user,
  );
  response.status(201).json({ data: serializeBike(bike) });
};

export const listBikes = async (request, response) => {
  const bikes = await bikeService.listBikes(request.validated.query.plate);
  response.json({ data: bikes.map(serializeBike) });
};

export const getBike = async (request, response) => {
  const bike = await bikeService.getBike(request.validated.params.id);
  response.json({ data: serializeBike(bike) });
};
