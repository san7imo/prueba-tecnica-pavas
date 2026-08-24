const plain = (resource) =>
  typeof resource?.get === 'function' ? resource.get({ plain: true }) : resource;

export const serializeClient = (resource) => {
  const client = plain(resource);
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
  };
};

export const serializeBike = (resource) => {
  const bike = plain(resource);
  return {
    id: bike.id,
    plate: bike.plate,
    brand: bike.brand,
    model: bike.model,
    cylinder: bike.cylinder,
    clientId: bike.clientId,
    client: bike.client ? serializeClient(bike.client) : undefined,
  };
};
