import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bikesApi } from '../src/api/bikesApi.js';
import { clientsApi } from '../src/api/clientsApi.js';
import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { BikeDetailPage } from '../src/pages/BikeDetailPage.jsx';
import { BikeFormPage } from '../src/pages/BikeFormPage.jsx';
import { BikesPage } from '../src/pages/BikesPage.jsx';
import { mechanicUser, renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/bikesApi.js', () => ({ bikesApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), changeOwner: vi.fn(), remove: vi.fn(), restore: vi.fn() } }));
vi.mock('../src/api/clientsApi.js', () => ({ clientsApi: { list: vi.fn(), getById: vi.fn() } }));
vi.mock('../src/api/workOrdersApi.js', () => ({ workOrdersApi: { list: vi.fn() } }));

const owner = { id: 1, name: 'Ana Torres', phone: '3001234567', email: 'ana@example.com', lifecycle: 'active' };
const bike = { id: 2, plate: 'ABC123', brand: 'Yamaha', model: 'FZ 2.0', cylinder: '149', clientId: 1, client: owner, lifecycle: 'active', currentOpenOrder: null };
const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };

describe('Motorcycle master screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bikesApi.list.mockResolvedValue({ data: [bike], meta });
    bikesApi.getById.mockResolvedValue(bike);
    clientsApi.list.mockResolvedValue({ data: [owner], meta });
    workOrdersApi.list.mockResolvedValue({ data: [], meta: { ...meta, pageSize: 10, totalItems: 0, totalPages: 0 } });
  });

  it('lists owner names, filters by plate prefix and hides ADMIN controls from mechanics', async () => {
    const { unmount } = renderWithAuth(<MemoryRouter><BikesPage /></MemoryRouter>);
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/inicio de placa/i), { target: { value: ' ab ' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(bikesApi.list).toHaveBeenLastCalledWith({ platePrefix: 'ab', lifecycle: 'active', page: 1, pageSize: 20 }));
    unmount();

    renderWithAuth(<MemoryRouter><BikesPage /></MemoryRouter>, { auth: { user: mechanicUser, accessToken: 'token', isAuthenticated: true, isLoading: false, sessionMessage: '', login: vi.fn(), logout: vi.fn() } });
    await screen.findByText('ABC123');
    expect(screen.queryByRole('link', { name: /nueva motocicleta/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/estado del registro/i)).not.toBeInTheDocument();
  });

  it('opens a plate-conflict recovery link with server-backed URL filters', async () => {
    renderWithAuth(
      <MemoryRouter initialEntries={['/bikes?platePrefix=abc%20123&lifecycle=all']}>
        <BikesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(bikesApi.list).toHaveBeenCalledWith({
      platePrefix: 'abc 123',
      lifecycle: 'all',
      page: 1,
      pageSize: 20,
    }));
    expect(screen.getByLabelText(/inicio de placa/i)).toHaveValue('abc 123');
    expect(screen.getByLabelText(/estado del registro/i)).toHaveValue('all');
  });

  it('creates a motorcycle by selecting an existing owner by name', async () => {
    bikesApi.create.mockResolvedValue(bike);
    renderWithAuth(<MemoryRouter initialEntries={['/bikes/new']}><Routes><Route path="/bikes/new" element={<BikeFormPage />} /><Route path="/bikes/:id" element={<h1>Moto guardada</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/placa/i), { target: { value: ' abc 123 ' } });
    fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Yamaha' } });
    fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'FZ 2.0' } });
    fireEvent.change(screen.getByLabelText(/buscar cliente activo/i), { target: { value: 'Ana' } });
    fireEvent.keyDown(screen.getByLabelText(/buscar cliente activo/i), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /ana torres/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar motocicleta/i }));
    await waitFor(() => expect(bikesApi.create).toHaveBeenCalledWith({ plate: 'abc 123', brand: 'Yamaha', model: 'FZ 2.0', cylinder: null, clientId: 1 }));
    expect(await screen.findByRole('heading', { name: /moto guardada/i })).toBeInTheDocument();
  });

  it('shows owner, open-order context, history and protected lifecycle mutation', async () => {
    const currentOpenOrder = { id: 8, entryDate: '2026-09-03T15:00:00.000Z', faultDescription: 'No enciende', status: 'DIAGNOSTICO', total: '25000.00' };
    bikesApi.getById.mockResolvedValue({ ...bike, currentOpenOrder });
    workOrdersApi.list.mockResolvedValue({ data: [currentOpenOrder], meta: { ...meta, pageSize: 10 } });
    bikesApi.remove.mockRejectedValue({ response: { status: 409, data: { error: { code: 'BIKE_HAS_ACTIVE_WORK_ORDER', message: 'No se puede eliminar una moto con orden abierta.' } } } });
    renderWithAuth(<MemoryRouter initialEntries={['/bikes/2']}><Routes><Route path="/bikes/:id" element={<BikeDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /orden #8/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana Torres' })).toHaveAttribute('href', '/clients/1');
    fireEvent.click(screen.getByRole('button', { name: /eliminar motocicleta/i }));
    fireEvent.change(screen.getByLabelText(/^motivo/i), { target: { value: 'Archivo solicitado.' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(await screen.findByText('No se puede eliminar una moto con orden abierta.')).toBeInTheDocument();
  });

  it('changes owner through its dedicated justified operation', async () => {
    const destination = { id: 9, name: 'Bruno Díaz', phone: '3019998877', email: null, lifecycle: 'active' };
    clientsApi.list.mockResolvedValue({ data: [destination], meta });
    bikesApi.changeOwner.mockResolvedValue({ ...bike, clientId: 9, client: destination });
    renderWithAuth(<MemoryRouter initialEntries={['/bikes/2/edit']}><Routes><Route path="/bikes/:id/edit" element={<BikeFormPage />} /><Route path="/bikes/:id" element={<h1>Propietario guardado</h1>} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: /editar motocicleta/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cambiar$/i }));
    fireEvent.change(screen.getByLabelText(/buscar cliente activo/i), { target: { value: 'Bruno' } });
    fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /bruno díaz/i }));
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), { target: { value: 'Venta confirmada por el cliente.' } });
    fireEvent.click(screen.getByRole('button', { name: /cambiar propietario/i }));
    await waitFor(() => expect(bikesApi.changeOwner).toHaveBeenCalledWith('2', { clientId: 9, reason: 'Venta confirmada por el cliente.' }));
    expect(await screen.findByRole('heading', { name: /propietario guardado/i })).toBeInTheDocument();
  });

  it('retries a failed motorcycle edit load without leaving the form route', async () => {
    bikesApi.getById
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce(bike);
    renderWithAuth(
      <MemoryRouter initialEntries={['/bikes/2/edit']}>
        <Routes><Route path="/bikes/:id/edit" element={<BikeFormPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/no fue posible preparar el formulario/i))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('heading', { name: /editar motocicleta/i }))
      .toBeInTheDocument();
    expect(bikesApi.getById).toHaveBeenCalledTimes(2);
  });

  it('restores a deleted motorcycle with a required reason', async () => {
    const deletedBike = { ...bike, lifecycle: 'deleted', deletedAt: '2026-09-01T12:00:00.000Z', deleteReason: 'Retirada temporalmente.' };
    bikesApi.getById.mockResolvedValue(deletedBike);
    bikesApi.restore.mockResolvedValue(bike);
    renderWithAuth(<MemoryRouter initialEntries={['/bikes/2']}><Routes><Route path="/bikes/:id" element={<BikeDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Retirada temporalmente.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /restaurar motocicleta/i }));
    fireEvent.change(screen.getByLabelText(/^motivo/i), { target: { value: 'Vuelve a operación.' } });
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    await waitFor(() => expect(bikesApi.restore).toHaveBeenCalledWith('2', 'Vuelve a operación.'));
  });
});
