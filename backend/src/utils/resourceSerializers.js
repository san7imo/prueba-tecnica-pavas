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

export const serializeWorkOrderItem = (resource) => {
  const item = plain(resource);
  return {
    id: item.id,
    type: item.type,
    description: item.description,
    count: item.count,
    unitValue: item.unitValue,
  };
};

export const serializeWorkOrder = (resource) => {
  const workOrder = plain(resource);
  const serialized = {
    id: workOrder.id,
    bikeId: workOrder.bikeId,
    entryDate: new Date(workOrder.entryDate).toISOString(),
    faultDescription: workOrder.faultDescription,
    status: workOrder.status,
    total: workOrder.total,
  };

  if (workOrder.bike) {
    serialized.bike = serializeBike(workOrder.bike);
  }
  if (Array.isArray(workOrder.items)) {
    serialized.items = workOrder.items.map(serializeWorkOrderItem);
  }

  return serialized;
};
