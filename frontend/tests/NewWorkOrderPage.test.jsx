import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bikesApi } from '../src/api/bikesApi.js';
import { clientsApi } from '../src/api/clientsApi.js';
import { usersApi } from '../src/api/usersApi.js';
import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { NewWorkOrderPage } from '../src/pages/NewWorkOrderPage.jsx';
import { bikeFixture, clientFixture } from './fixtures.js';

vi.mock('../src/api/bikesApi.js', () => ({
  bikesApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn() },
}));
vi.mock('../src/api/clientsApi.js', () => ({
  clientsApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn() },
}));
vi.mock('../src/api/usersApi.js', () => ({ usersApi: { list: vi.fn() } }));
vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: { create: vi.fn() },
}));

const activeClient = { ...clientFixture, lifecycle: 'active' };
const activeBike = {
  ...bikeFixture,
  lifecycle: 'active',
  client: activeClient,
};
const mechanic = {
  id: 8,
  name: 'Marta Mecánica',
  email: 'marta@example.test',
  role: 'MECANICO',
  active: true,
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/orders/new']}>
    <Routes>
      <Route path="/orders/new" element={<NewWorkOrderPage />} />
      <Route path="/orders/:id" element={<h1>Detalle creado</h1>} />
      <Route path="/orders" element={<h1>Listado</h1>} />
    </Routes>
  </MemoryRouter>,
);

const searchAndSelectClient = async () => {
  fireEvent.change(screen.getByLabelText(/buscar cliente activo/i), {
    target: { value: 'Ana' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Ana Torres/i }));
  await waitFor(() => expect(bikesApi.list).toHaveBeenCalledWith({
    clientId: activeClient.id,
    lifecycle: 'active',
    pageSize: 100,
  }));
};

const selectExistingBike = async () => {
  const bikeButton = await screen.findByRole('button', { name: /ABC123/i });
  fireEvent.click(bikeButton);
  await waitFor(() => expect(bikesApi.getById).toHaveBeenCalledWith(activeBike.id));
};

const openQuickClientForm = async () => {
  clientsApi.list.mockResolvedValue({ data: [], meta: {} });
  fireEvent.change(screen.getByLabelText(/buscar cliente activo/i), {
    target: { value: 'Nuevo cliente' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /registrar cliente nuevo/i }));
};

const fillQuickClient = () => {
  const form = screen.getByRole('form', { name: /registro rápido de cliente/i });
  fireEvent.change(within(form).getByLabelText(/^cédula/i), {
    target: { value: '1020304050' },
  });
  fireEvent.change(screen.getByLabelText(/nombre completo/i), {
    target: { value: 'Ana Torres' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /^teléfono/i }), {
    target: { value: '3001234567' },
  });
  fireEvent.change(screen.getByLabelText(/^correo/i), {
    target: { value: 'ana@example.com' },
  });
};

describe('NewWorkOrderPage reuse-first flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersApi.list.mockResolvedValue([
      mechanic,
      { id: 9, name: 'Mecánico inactivo', role: 'MECANICO', active: false },
      { id: 10, name: 'Administrador', role: 'ADMIN', active: true },
    ]);
    clientsApi.list.mockResolvedValue({ data: [activeClient], meta: {} });
    bikesApi.list.mockResolvedValue({ data: [activeBike], meta: {} });
    bikesApi.getById.mockResolvedValue({
      ...activeBike,
      currentOpenOrder: null,
    });
  });

  it('selects an existing client and owned bike before creating an assigned order', async () => {
    workOrdersApi.create.mockResolvedValue({ id: 15 });
    renderPage();

    expect(screen.queryByText(/placa de la moto/i)).not.toBeInTheDocument();
    await searchAndSelectClient();
    await selectExistingBike();
    expect(await screen.findByText(/motocicleta: ABC123 · cliente: Ana Torres/i))
      .toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), {
      target: { value: 'Freno delantero sin presión' },
    });
    fireEvent.change(screen.getByLabelText(/mecánico responsable/i), {
      target: { value: String(mechanic.id) },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear orden de trabajo/i }));

    await waitFor(() => expect(workOrdersApi.create).toHaveBeenCalledWith({
      bikeId: activeBike.id,
      faultDescription: 'Freno delantero sin presión',
      assignedMechanicId: mechanic.id,
    }));
    expect(await screen.findByRole('heading', { name: /detalle creado/i }))
      .toBeInTheDocument();
  });

  it('creates client and bike only through subordinate branches when no records exist', async () => {
    clientsApi.create.mockResolvedValue(activeClient);
    bikesApi.list.mockResolvedValue({ data: [], meta: {} });
    bikesApi.create.mockResolvedValue(activeBike);
    renderPage();

    await openQuickClientForm();
    fillQuickClient();
    fireEvent.click(screen.getByRole('button', { name: /^guardar cliente$/i }));

    expect(await screen.findByText(/motocicletas activas registradas para Ana Torres/i))
      .toBeInTheDocument();
    expect(clientsApi.create).toHaveBeenCalledWith({
      documentNumber: '1020304050',
      name: 'Ana Torres',
      phone: '3001234567',
      email: 'ana@example.com',
    });
    fireEvent.click(await screen.findByRole('button', { name: /registrar motocicleta/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /^placa/i }), {
      target: { value: 'abc 123' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^marca/i }), {
      target: { value: 'Yamaha' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^modelo/i }), {
      target: { value: 'FZ 2.0' },
    });
    fireEvent.change(screen.getByLabelText(/cilindraje/i), {
      target: { value: '149' },
    });
    fireEvent.click(screen.getByRole('button', {
      name: /guardar y seleccionar motocicleta/i,
    }));

    await waitFor(() => expect(bikesApi.create).toHaveBeenCalledWith({
      plate: 'abc 123',
      brand: 'Yamaha',
      model: 'FZ 2.0',
      cylinder: '149',
      clientId: activeClient.id,
    }));
    expect(await screen.findByText(/motocicleta: ABC123/i)).toBeInTheDocument();
  });

  it('routes a plate conflict to the existing motorcycle recovery view', async () => {
    bikesApi.list.mockResolvedValue({ data: [], meta: {} });
    bikesApi.create.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'BIKE_RESTORE_REQUIRED',
            message: 'La placa pertenece a una motocicleta eliminada.',
          },
        },
      },
    });
    renderPage();

    await searchAndSelectClient();
    fireEvent.click(await screen.findByRole('button', { name: /registrar motocicleta/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /^placa/i }), {
      target: { value: 'abc 123' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^marca/i }), {
      target: { value: 'Yamaha' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^modelo/i }), {
      target: { value: 'FZ 2.0' },
    });
    fireEvent.click(screen.getByRole('button', {
      name: /guardar y seleccionar motocicleta/i,
    }));

    expect((await screen.findAllByText(/placa pertenece a una motocicleta eliminada/i)).length)
      .toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /buscar y revisar la motocicleta existente/i }))
      .toHaveAttribute('href', '/bikes?platePrefix=abc%20123&lifecycle=all');
  });

  it('offers reuse of an active duplicate before allowing a justified override', async () => {
    clientsApi.create
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'CLIENT_DUPLICATE_RISK',
              message: 'Possible duplicate.',
              details: { candidateIds: [activeClient.id], matchedFields: ['phone'] },
            },
          },
        },
      })
      .mockResolvedValueOnce({ ...activeClient, id: 22, name: 'Ana Diferente' });
    clientsApi.getById.mockResolvedValue(activeClient);
    bikesApi.list.mockResolvedValue({ data: [], meta: {} });
    renderPage();

    await openQuickClientForm();
    fillQuickClient();
    fireEvent.click(screen.getByRole('button', { name: /^guardar cliente$/i }));
    const reuse = await screen.findByRole('button', { name: /usar este cliente/i });
    expect(reuse).toBeInTheDocument();
    expect(screen.getByLabelText(/justificación para conservar ambos clientes/i))
      .toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/justificación para conservar ambos clientes/i), {
      target: { value: 'Dos familiares comparten el teléfono.' },
    });
    fireEvent.click(screen.getByRole('button', {
      name: /confirmar cliente diferente/i,
    }));

    await waitFor(() => expect(clientsApi.create).toHaveBeenLastCalledWith({
      documentNumber: '1020304050',
      name: 'Ana Torres',
      phone: '3001234567',
      email: 'ana@example.com',
      confirmDuplicate: true,
      duplicateReason: 'Dos familiares comparten el teléfono.',
    }));
    expect(await screen.findByText(/motocicletas activas registradas para Ana Diferente/i))
      .toBeInTheDocument();
  });

  it('can reuse the active duplicate without submitting an override', async () => {
    clientsApi.create.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'CLIENT_DUPLICATE_RISK',
            message: 'Possible duplicate.',
            details: { candidateIds: [activeClient.id], matchedFields: ['email'] },
          },
        },
      },
    });
    clientsApi.getById.mockResolvedValue(activeClient);
    bikesApi.list.mockResolvedValue({ data: [], meta: {} });
    renderPage();

    await openQuickClientForm();
    fillQuickClient();
    fireEvent.click(screen.getByRole('button', { name: /^guardar cliente$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /usar este cliente/i }));

    expect(clientsApi.create).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/motocicletas activas registradas para Ana Torres/i))
      .toBeInTheDocument();
  });

  it('requires restoration instead of creating over a deleted duplicate', async () => {
    const deletedClient = { ...activeClient, lifecycle: 'deleted' };
    clientsApi.create.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'CLIENT_RESTORE_REQUIRED',
            message: 'Restore required.',
            details: { candidateIds: [activeClient.id], matchedFields: ['phone'] },
          },
        },
      },
    });
    clientsApi.getById.mockResolvedValue(deletedClient);
    renderPage();

    await openQuickClientForm();
    fillQuickClient();
    fireEvent.click(screen.getByRole('button', { name: /^guardar cliente$/i }));

    expect(await screen.findByText(/cliente eliminado que debe restaurarse/i))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver cliente/i }))
      .toHaveAttribute('href', `/clients/${activeClient.id}`);
    expect(screen.queryByRole('button', { name: /usar este cliente/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar cliente diferente/i }))
      .not.toBeInTheDocument();
  });

  it('blocks a bike with an open order and links to the existing work', async () => {
    bikesApi.getById.mockResolvedValue({
      ...activeBike,
      currentOpenOrder: { id: 77, status: 'EN_PROCESO' },
    });
    renderPage();

    await searchAndSelectClient();
    await selectExistingBike();

    expect(await screen.findByText(/ya tiene una orden abierta/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir orden existente/i }))
      .toHaveAttribute('href', '/orders/77');
    expect(screen.getByRole('button', { name: /crear orden de trabajo/i }))
      .toBeDisabled();
  });

  it('surfaces an authoritative active-order race and keeps duplicate submits blocked', async () => {
    let rejectOrder;
    workOrdersApi.create.mockReturnValue(new Promise((_resolve, reject) => {
      rejectOrder = reject;
    }));
    bikesApi.getById
      .mockResolvedValueOnce({ ...activeBike, currentOpenOrder: null })
      .mockResolvedValueOnce({
        ...activeBike,
        currentOpenOrder: { id: 88, status: 'RECIBIDA' },
      });
    renderPage();

    await searchAndSelectClient();
    await selectExistingBike();
    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), {
      target: { value: 'No enciende' },
    });
    const submit = screen.getByRole('button', { name: /crear orden de trabajo/i });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(workOrdersApi.create).toHaveBeenCalledTimes(1);

    rejectOrder({
      response: {
        status: 409,
        data: {
          error: {
            code: 'BIKE_HAS_ACTIVE_WORK_ORDER',
            message: 'Motorcycle already has an open work order.',
          },
        },
      },
    });
    expect(await screen.findByText(/actualiza la selección y continúa esa orden/i))
      .toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /abrir orden existente/i }))
      .toHaveAttribute('href', '/orders/88');
  });

  it('allows an explicit unassigned order and recovers the mechanic catalogue', async () => {
    usersApi.list
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce([mechanic]);
    workOrdersApi.create.mockResolvedValue({ id: 16 });
    renderPage();

    expect(await screen.findByText(/puedes crear la orden sin asignar/i))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(2));
    await searchAndSelectClient();
    await selectExistingBike();
    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), {
      target: { value: 'Vibración' },
    });
    expect(screen.getByLabelText(/mecánico responsable/i)).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: /crear orden de trabajo/i }));

    await waitFor(() => expect(workOrdersApi.create).toHaveBeenCalledWith({
      bikeId: activeBike.id,
      faultDescription: 'Vibración',
    }));
  });

  it('refreshes the catalogue when the backend rejects a stale mechanic', async () => {
    usersApi.list
      .mockResolvedValueOnce([mechanic])
      .mockResolvedValueOnce([]);
    workOrdersApi.create.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            code: 'MECHANIC_INACTIVE',
            message: 'Only an active mechanic can be assigned.',
          },
        },
      },
    });
    renderPage();

    await searchAndSelectClient();
    await selectExistingBike();
    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), {
      target: { value: 'Revisión eléctrica' },
    });
    fireEvent.change(screen.getByLabelText(/mecánico responsable/i), {
      target: { value: String(mechanic.id) },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear orden de trabajo/i }));

    expect(await screen.findByText(/mecánico seleccionado ya no está disponible/i))
      .toBeInTheDocument();
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/mecánico responsable/i)).toHaveValue('');
  });
});
