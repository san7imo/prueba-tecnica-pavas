import { userService } from '../services/userService.js';
import { serializeManagedUser } from '../utils/resourceSerializers.js';

export const registerUser = async (request, response) => {
  const user = await userService.createUser(
    request.validated.body,
    request.user,
  );
  response.status(201).json({ data: serializeManagedUser(user) });
};

export const listUsers = async (_request, response) => {
  const users = await userService.listUsers();
  response.json({ data: users.map(serializeManagedUser) });
};

export const changeUserRole = async (request, response) => {
  const user = await userService.changeRole(
    request.validated.params.id,
    request.validated.body.role,
  );
  response.json({ data: serializeManagedUser(user) });
};

export const changeUserActive = async (request, response) => {
  const user = await userService.changeActive(
    request.validated.params.id,
    request.validated.body.active,
  );
  response.json({ data: serializeManagedUser(user) });
};
