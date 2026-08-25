import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bikesApi } from '../src/api/bikesApi.js';
import { clientsApi } from '../src/api/clientsApi.js';
import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { NewWorkOrderPage } from '../src/pages/NewWorkOrderPage.jsx';
import { bikeFixture, clientFixture } from './fixtures.js';

vi.mock('../src/api/bikesApi.js', () => ({ bikesApi: { list: vi.fn(), create: vi.fn() } }));
vi.mock('../src/api/clientsApi.js', () => ({ clientsApi: { create: vi.fn() } }));
vi.mock('../src/api/workOrdersApi.js', () => ({ workOrdersApi: { create: vi.fn() } }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/orders/new']}>
    <Routes>
      <Route path="/orders/new" element={<NewWorkOrderPage />} />
      <Route path="/orders/:id" element={<h1>Detalle creado</h1>} />
      <Route path="/orders" element={<h1>Listado</h1>} />
    </Routes>
  </MemoryRouter>,
);

const searchPlate = async (plate = 'ABC123') => {
  fireEvent.change(screen.getByLabelText(/placa de la moto/i), { target: { value: plate } });
  fireEvent.click(screen.getByRole('button', { name: /buscar por placa/i }));
};

describe('NewWorkOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds and selects an existing bike, then creates an order without status or total', async () => {
    bikesApi.list.mockResolvedValue([bikeFixture]);
    workOrdersApi.create.mockResolvedValue({ id: 15 });
    renderPage();

    await searchPlate();
    expect(await screen.findByText(/moto seleccionada: ABC123/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), { target: { value: 'Freno delantero sin presión' } });
    fireEvent.click(screen.getByRole('button', { name: /crear orden de trabajo/i }));

    await waitFor(() => expect(workOrdersApi.create).toHaveBeenCalledWith({
      bikeId: 2,
      faultDescription: 'Freno delantero sin presión',
    }));
    expect(await screen.findByRole('heading', { name: /detalle creado/i })).toBeInTheDocument();
  });

  it('chains quick client and bike registration and auto-selects the new bike', async () => {
    bikesApi.list.mockResolvedValue([]);
    clientsApi.create.mockResolvedValue(clientFixture);
    bikesApi.create.mockResolvedValue(bikeFixture);
    renderPage();

    await searchPlate('abc 123');
    expect(await screen.findByText(/no encontramos una moto/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Ana Torres' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^teléfono$/i }), { target: { value: '3001234567' } });
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente/i }));

    expect(await screen.findByText(/cliente creado/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^marca$/i }), { target: { value: 'Yamaha' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^modelo$/i }), { target: { value: 'FZ 2.0' } });
    fireEvent.change(screen.getByLabelText(/cilindraje/i), { target: { value: '149' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar y seleccionar moto/i }));

    await waitFor(() => expect(bikesApi.create).toHaveBeenCalledWith({
      plate: 'ABC 123',
      brand: 'Yamaha',
      model: 'FZ 2.0',
      cylinder: '149',
      clientId: 1,
    }));
    expect(await screen.findByText(/moto seleccionada: ABC123/i)).toBeInTheDocument();
  });

  it('shows backend errors and prevents duplicate order submissions', async () => {
    bikesApi.list.mockResolvedValue([bikeFixture]);
    let rejectOrder;
    workOrdersApi.create.mockReturnValue(new Promise((_resolve, reject) => { rejectOrder = reject; }));
    renderPage();
    await searchPlate();
    await screen.findByText(/moto seleccionada: ABC123/i);
    fireEvent.change(screen.getByLabelText(/descripción de la falla/i), { target: { value: 'No enciende' } });
    const button = screen.getByRole('button', { name: /crear orden de trabajo/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(workOrdersApi.create).toHaveBeenCalledTimes(1);
    rejectOrder({ response: { status: 404, data: { error: { code: 'BIKE_NOT_FOUND', message: 'La moto ya no existe.' } } } });
    expect(await screen.findByText('La moto ya no existe.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear orden de trabajo/i })).toBeEnabled();
  });

  it('shows a clear bike-search error without opening quick registration', async () => {
    bikesApi.list.mockRejectedValue({ response: { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'No se pudo consultar motos.' } } } });
    renderPage();
    await searchPlate();

    expect(await screen.findByText('No se pudo consultar motos.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: /registro rápido de cliente/i })).not.toBeInTheDocument();
  });
});
