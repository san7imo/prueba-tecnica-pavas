import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { WorkOrderDetailPage } from '../src/pages/WorkOrderDetailPage.jsx';
import { orderFixture } from './fixtures.js';

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: {
    getById: vi.fn(),
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/orders/7']}>
    <Routes>
      <Route path="/orders/:id" element={<WorkOrderDetailPage />} />
      <Route path="/orders" element={<h1>Listado</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('WorkOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workOrdersApi.getById.mockResolvedValue(orderFixture);
  });

  it('shows loading, related data, items, exact subtotals, total and valid actions only', async () => {
    renderPage();
    expect(screen.getByText(/cargando detalle/i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: /orden #7/i })).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Ruido anormal en la transmisión')).toBeInTheDocument();
    expect(screen.getAllByText(/130\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/100\.000,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mover a diagnóstico/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar orden/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mover a lista/i })).not.toBeInTheDocument();
  });

  it('adds and deletes items, refetching the authoritative total after each mutation', async () => {
    workOrdersApi.addItem.mockResolvedValue({ item: {}, workOrderTotal: '180000.00' });
    workOrdersApi.deleteItem.mockResolvedValue({ deletedItemId: 9, workOrderTotal: '30000.00' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.change(screen.getByLabelText(/^descripción$/i), { target: { value: 'Revisión eléctrica' } });
    fireEvent.change(screen.getByLabelText(/^cantidad$/i), { target: { value: '1.50' } });
    fireEvent.change(screen.getByLabelText(/valor unitario/i), { target: { value: '20000.00' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar ítem/i }));
    await waitFor(() => expect(workOrdersApi.addItem).toHaveBeenCalledWith('7', {
      type: 'MANO_OBRA', description: 'Revisión eléctrica', count: '1.50', unitValue: '20000.00',
    }));
    await screen.findByText(/ítem agregado y total actualizado/i);

    fireEvent.click(screen.getByRole('button', { name: /eliminar kit de arrastre/i }));
    await waitFor(() => expect(workOrdersApi.deleteItem).toHaveBeenCalledWith(9));
    expect(await screen.findByText(/ítem eliminado y total actualizado/i)).toBeInTheDocument();
    expect(workOrdersApi.getById).toHaveBeenCalledTimes(3);
  });

  it('updates only to an allowed state and sends the Phase 2-compatible body through the API module', async () => {
    workOrdersApi.updateStatus.mockResolvedValue({ id: 7, status: 'DIAGNOSTICO' });
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.click(screen.getByRole('button', { name: /mover a diagnóstico/i }));
    await waitFor(() => expect(workOrdersApi.updateStatus).toHaveBeenCalledWith('7', 'DIAGNOSTICO'));
    expect(await screen.findByText(/estado actualizado a DIAGNOSTICO/i)).toBeInTheDocument();
  });

  it('requires confirmation for cancellation and shows backend transition errors', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    workOrdersApi.updateStatus.mockRejectedValue({ response: { status: 400, data: { error: { code: 'INVALID_STATUS_TRANSITION', message: 'La transición ya no es válida.' } } } });
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.click(screen.getByRole('button', { name: /cancelar orden/i }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('La transición ya no es válida.')).toBeInTheDocument();
  });

  it('shows terminal feedback without transition buttons', async () => {
    workOrdersApi.getById.mockResolvedValue({ ...orderFixture, status: 'ENTREGADA' });
    renderPage();

    expect(await screen.findByText(/estado final y no admite más cambios/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mover a/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar orden/i })).not.toBeInTheDocument();
  });

  it('renders a specific not-found state', async () => {
    workOrdersApi.getById.mockRejectedValue({ response: { status: 404, data: { error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found.' } } } });
    renderPage();

    expect(await screen.findByRole('heading', { name: /orden no encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al listado/i })).toBeInTheDocument();
  });
});
