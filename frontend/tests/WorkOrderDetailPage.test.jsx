import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { usersApi } from '../src/api/usersApi.js';
import { WorkOrderDetailPage } from '../src/pages/WorkOrderDetailPage.jsx';
import { orderFixture } from './fixtures.js';
import { adminUser, authValue, mechanicUser, renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: {
    getById: vi.fn(),
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    updateStatus: vi.fn(),
    changeAssignment: vi.fn(),
    getHistory: vi.fn(),
  },
}));
vi.mock('../src/api/usersApi.js', () => ({ usersApi: { list: vi.fn() } }));

const emptyHistory = { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };

const renderPage = (user = adminUser) => renderWithAuth(
  <MemoryRouter initialEntries={['/orders/7']}>
    <Routes>
      <Route path="/orders/:id" element={<WorkOrderDetailPage />} />
      <Route path="/orders" element={<h1>Listado</h1>} />
    </Routes>
  </MemoryRouter>,
  { auth: authValue(user) },
);

describe('WorkOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workOrdersApi.getById.mockResolvedValue(orderFixture);
    workOrdersApi.getHistory.mockResolvedValue(emptyHistory);
    usersApi.list.mockResolvedValue([
      orderFixture.assignedMechanic,
      {
        id: 8,
        name: 'Laura Mecánica',
        email: 'laura@pavas.test',
        role: 'MECANICO',
        active: true,
      },
      { id: 9, name: 'Admin', role: 'ADMIN', active: true },
      { id: 10, name: 'Inactivo', role: 'MECANICO', active: false },
    ]);
  });

  it('shows loading, related data, items, exact subtotals, total and valid actions only', async () => {
    renderPage();
    expect(screen.getByText(/cargando detalle/i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: /orden #7/i })).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Ruido anormal en la transmisión')).toBeInTheDocument();
    expect(screen.getAllByText(/130\.000,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/100\.000,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar diagnóstico/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar orden/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como lista/i })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /tabla de ítems/i })).toHaveAttribute('tabindex', '0');
  });

  it('adds and deletes items, refetching the authoritative total after each mutation', async () => {
    workOrdersApi.addItem.mockResolvedValue({ item: {}, workOrderTotal: '180000.00' });
    workOrdersApi.deleteItem.mockResolvedValue({ deletedItemId: 9, workOrderTotal: '30000.00' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.change(screen.getByRole('textbox', { name: /^descripción$/i }), { target: { value: 'Revisión eléctrica' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^cantidad$/i }), { target: { value: '1.50' } });
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

    fireEvent.change(screen.getByLabelText(/nota/i), { target: { value: '  Diagnóstico iniciado  ' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar diagnóstico/i }));
    await waitFor(() => expect(workOrdersApi.updateStatus).toHaveBeenCalledWith('7', 'DIAGNOSTICO', '  Diagnóstico iniciado  '));
    expect(await screen.findByText(/estado actualizado a diagnóstico/i)).toBeInTheDocument();
  });

  it('hides deletion, cancellation and delivery controls from a mechanic', async () => {
    workOrdersApi.getById.mockResolvedValue({ ...orderFixture, status: 'LISTA' });
    renderPage(mechanicUser);

    await screen.findByRole('heading', { name: /orden #7/i });
    expect(screen.queryByRole('button', { name: /eliminar kit de arrastre/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar orden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /entregar orden/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a diagnóstico/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /volver a reparación/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /agregar ítem/i })).toBeInTheDocument();
  });

  it('keeps the next intermediate transition available to a mechanic', async () => {
    workOrdersApi.getById.mockResolvedValue({ ...orderFixture, status: 'DIAGNOSTICO' });
    renderPage(mechanicUser);

    await screen.findByRole('heading', { name: /orden #7/i });
    expect(screen.getByRole('button', { name: /iniciar reparación/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar orden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /entregar orden/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mauro Mecánico/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nuevo responsable/i)).not.toBeInTheDocument();
  });

  it('requires a reason and confirmation before a controlled regression', async () => {
    workOrdersApi.getById.mockResolvedValue({
      ...orderFixture,
      status: 'EN_PROCESO',
    });
    workOrdersApi.updateStatus.mockResolvedValue({ id: 7, status: 'DIAGNOSTICO' });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    const regression = screen.getByRole('button', { name: /volver a diagnóstico/i });
    expect(regression).toBeDisabled();
    expect(screen.getByText(/obligatorio para retrocesos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/nota \/ motivo/i), {
      target: { value: '  Se encontró una falla adicional  ' },
    });
    expect(regression).toBeEnabled();

    fireEvent.click(regression);
    expect(workOrdersApi.updateStatus).not.toHaveBeenCalled();
    fireEvent.click(regression);

    await waitFor(() => expect(workOrdersApi.updateStatus).toHaveBeenCalledWith(
      '7',
      'DIAGNOSTICO',
      '  Se encontró una falla adicional  ',
    ));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/de En proceso a Diagnóstico.*motivo quedará registrado/i),
    );
  });

  it('offers both controlled returns from LISTA to the assigned mechanic', async () => {
    workOrdersApi.getById.mockResolvedValue({ ...orderFixture, status: 'LISTA' });
    workOrdersApi.updateStatus.mockResolvedValue({ id: 7, status: 'EN_PROCESO' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(mechanicUser);
    await screen.findByRole('heading', { name: /orden #7/i });

    const toDiagnosis = screen.getByRole('button', { name: /volver a diagnóstico/i });
    const toRepair = screen.getByRole('button', { name: /volver a reparación/i });
    expect(toDiagnosis).toBeDisabled();
    expect(toRepair).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/nota \/ motivo/i), {
      target: { value: 'La prueba final falló.' },
    });
    expect(toDiagnosis).toBeEnabled();
    expect(toRepair).toBeEnabled();
    expect(screen.queryByRole('button', { name: /entregar orden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar orden/i })).not.toBeInTheDocument();
    fireEvent.click(toRepair);
    await waitFor(() => expect(workOrdersApi.updateStatus).toHaveBeenCalledWith(
      '7',
      'EN_PROCESO',
      'La prueba final falló.',
    ));
  });

  it('allows ADMIN to assign an unassigned order without a reason', async () => {
    const unassigned = {
      ...orderFixture,
      assignedMechanicId: null,
      assignedMechanic: null,
    };
    workOrdersApi.getById.mockResolvedValue(unassigned);
    workOrdersApi.changeAssignment.mockResolvedValue({
      ...unassigned,
      assignedMechanicId: 8,
      assignedMechanic: {
        id: 8,
        name: 'Laura Mecánica',
        email: 'laura@pavas.test',
        role: 'MECANICO',
        active: true,
      },
    });
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.change(await screen.findByLabelText(/nuevo responsable/i), {
      target: { value: '8' },
    });
    expect(screen.queryByLabelText(/motivo del cambio/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /guardar responsable/i }));

    await waitFor(() => expect(workOrdersApi.changeAssignment)
      .toHaveBeenCalledWith(7, 8, ''));
    expect(await screen.findByText(/responsable actualizado a Laura Mecánica/i))
      .toBeInTheDocument();
  });

  it('requires reason and confirmation to reassign', async () => {
    const updated = {
      ...orderFixture,
      assignedMechanicId: 8,
      assignedMechanic: {
        id: 8,
        name: 'Laura Mecánica',
        email: 'laura@pavas.test',
        role: 'MECANICO',
        active: true,
      },
    };
    workOrdersApi.changeAssignment.mockResolvedValue(updated);
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.change(await screen.findByLabelText(/nuevo responsable/i), {
      target: { value: '8' },
    });
    const save = screen.getByRole('button', { name: /guardar responsable/i });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), {
      target: { value: '  Redistribución de carga  ' },
    });
    fireEvent.click(save);
    expect(workOrdersApi.changeAssignment).not.toHaveBeenCalled();
    fireEvent.click(save);

    await waitFor(() => expect(workOrdersApi.changeAssignment)
      .toHaveBeenCalledWith(7, 8, '  Redistribución de carga  '));
    expect(window.confirm).toHaveBeenCalledTimes(2);
  });

  it('requires reason and confirmation to unassign an order', async () => {
    const updated = {
      ...orderFixture,
      assignedMechanicId: null,
      assignedMechanic: null,
    };
    workOrdersApi.changeAssignment.mockResolvedValue(updated);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByRole('heading', { name: /orden #7/i });

    fireEvent.change(await screen.findByLabelText(/nuevo responsable/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), {
      target: { value: '  Esperando nueva asignación  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar responsable/i }));

    await waitFor(() => expect(workOrdersApi.changeAssignment)
      .toHaveBeenCalledWith(7, null, '  Esperando nueva asignación  '));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/orden quedó sin responsable/i))
      .toBeInTheDocument();
  });

  it('shows a recoverable mechanic-catalogue error to ADMIN', async () => {
    usersApi.list
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce([orderFixture.assignedMechanic]);
    renderPage();

    expect(await screen.findByText(/no fue posible consultar los mecánicos activos/i))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/no fue posible consultar los mecánicos activos/i))
      .not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /iniciar|marcar|entregar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar orden/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nuevo responsable/i)).not.toBeInTheDocument();
  });

  it('renders a specific not-found state', async () => {
    workOrdersApi.getById.mockRejectedValue({ response: { status: 404, data: { error: { code: 'WORK_ORDER_NOT_FOUND', message: 'Work order not found.' } } } });
    renderPage();

    expect(await screen.findByRole('heading', { name: /orden no encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al listado/i })).toBeInTheDocument();
  });
});
