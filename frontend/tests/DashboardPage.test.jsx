import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { DashboardPage } from '../src/pages/DashboardPage.jsx';
import { orderFixture } from './fixtures.js';
import { authValue, mechanicUser, renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: { list: vi.fn() },
}));

const resultFor = (status, count = 0) => ({
  data: count > 0 ? [{ ...orderFixture, status }] : [],
  meta: { page: 1, pageSize: 3, totalItems: count, totalPages: count ? 1 : 0 },
});

const renderDashboard = (user) => renderWithAuth(
  <MemoryRouter><DashboardPage /></MemoryRouter>,
  user ? { auth: authValue(user) } : undefined,
);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workOrdersApi.list.mockImplementation(({ status }) =>
      Promise.resolve(resultFor(status, status === 'RECIBIDA' ? 1 : 0)));
  });

  it('loads ADMIN operational queues and links each count to the filtered work list', async () => {
    renderDashboard();

    expect(screen.getByText(/consultando colas operativas/i)).toBeInTheDocument();
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(workOrdersApi.list).toHaveBeenCalledTimes(4);
    for (const status of ['RECIBIDA', 'DIAGNOSTICO', 'EN_PROCESO', 'LISTA']) {
      expect(workOrdersApi.list).toHaveBeenCalledWith({
        status,
        scope: 'all',
        page: 1,
        pageSize: 3,
      });
    }
    expect(screen.getByRole('link', { name: /abrir cola recibida/i }))
      .toHaveAttribute('href', '/orders?scope=all&status=RECIBIDA');
    expect(screen.getByRole('link', { name: /órdenes sin asignar/i }))
      .toHaveAttribute('href', '/orders?scope=unassigned');
    expect(screen.getByRole('link', { name: /nueva orden/i }))
      .toHaveAttribute('href', '/orders/new');
  });

  it('uses only mine scope for MECANICO and hides administrative shortcuts', async () => {
    renderDashboard(mechanicUser);

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/órdenes abiertas asignadas a Mauro Mecánico/i))
      .toBeInTheDocument();
    for (const status of ['RECIBIDA', 'DIAGNOSTICO', 'EN_PROCESO', 'LISTA']) {
      expect(workOrdersApi.list).toHaveBeenCalledWith({
        status,
        scope: 'mine',
        page: 1,
        pageSize: 3,
      });
    }
    expect(screen.getByRole('link', { name: /mis órdenes/i }))
      .toHaveAttribute('href', '/orders?scope=mine');
    expect(screen.queryByRole('link', { name: /órdenes sin asignar/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva orden/i }))
      .not.toBeInTheDocument();
  });

  it('shows a useful empty state when no open work exists', async () => {
    workOrdersApi.list.mockImplementation(({ status }) =>
      Promise.resolve(resultFor(status)));
    renderDashboard();

    expect(await screen.findByText(/no hay órdenes abiertas en el taller/i))
      .toBeInTheDocument();
    expect(screen.getAllByText(/sin órdenes en esta etapa/i)).toHaveLength(4);
  });

  it('reports a queue failure and retries all operational reads', async () => {
    workOrdersApi.list
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Colas temporalmente no disponibles.' } } },
      });
    renderDashboard();

    expect(await screen.findByText('Colas temporalmente no disponibles.'))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(workOrdersApi.list).toHaveBeenCalledTimes(8));
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
  });
});
