export const clientFixture = {
  id: 1,
  documentNumber: '1020304050',
  name: 'Ana Torres',
  phone: '3001234567',
  email: 'ana@example.com',
};

export const bikeFixture = {
  id: 2,
  plate: 'ABC123',
  brand: 'Yamaha',
  model: 'FZ 2.0',
  cylinder: '149',
  clientId: 1,
  client: clientFixture,
};

export const orderFixture = {
  id: 7,
  bikeId: 2,
  entryDate: '2026-08-24T15:00:00.000Z',
  faultDescription: 'Ruido anormal en la transmisión',
  status: 'RECIBIDA',
  total: '130000.00',
  assignedMechanicId: 2,
  assignedMechanic: {
    id: 2,
    name: 'Mauro Mecánico',
    email: 'mauro@pavas.test',
    role: 'MECANICO',
    active: true,
  },
  bike: bikeFixture,
  items: [
    {
      id: 9,
      type: 'REPUESTO',
      description: 'Kit de arrastre',
      count: '2.00',
      unitValue: '50000.00',
      createdByUserId: 2,
      createdBy: { id: 2, name: 'Mauro Mecánico' },
    },
    {
      id: 10,
      type: 'MANO_OBRA',
      description: 'Instalación',
      count: '1.00',
      unitValue: '30000.00',
      createdByUserId: 1,
      createdBy: { id: 1, name: 'Admin PAVAS' },
    },
  ],
};
