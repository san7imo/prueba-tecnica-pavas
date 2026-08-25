import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { WorkOrdersPage } from '../src/pages/WorkOrdersPage.jsx';
import { orderFixture } from './fixtures.js';

vi.mock('../src/api/workOrdersApi.js', () => ({
  workOrdersApi: { list: vi.fn() },
}));

const emptyResult = {
  data: [],
  meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
};

const renderPage = () => render(<MemoryRouter><WorkOrdersPage /></MemoryRouter>);

describe('WorkOrdersPage', () => {
  beforeEach(() => {
    workOrdersApi.list.mockReset();
  });

  it('shows loading and then the empty state', async () => {
    let resolveRequest;
    workOrdersApi.list.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderPage();

    expect(screen.getByText(/consultando órdenes/i)).toBeInTheDocument();
    resolveRequest(emptyResult);
    expect(await screen.findByText(/aún no hay órdenes/i)).toBeInTheDocument();
  });

  it('renders columns, data, status badge and authoritative total', async () => {
    workOrdersApi.list.mockResolvedValue({
      data: [orderFixture],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
    renderPage();

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Recibida' })).toBeInTheDocument();
    expect(screen.getByText(/130\.000,00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver orden 7/i })).toHaveAttribute('href', '/orders/7');
    expect(screen.getByRole('region', { name: /tabla de órdenes/i })).toHaveAttribute('tabindex', '0');
  });

  it('applies server filters, resets the page and paginates', async () => {
    workOrdersApi.list
      .mockResolvedValueOnce({
        data: [orderFixture],
        meta: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [orderFixture],
        meta: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [orderFixture],
        meta: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 },
      });
    renderPage();
    await screen.findByText('ABC123');

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'RECIBIDA' } });
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: ' abc 123 ' } });
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));

    await waitFor(() => expect(workOrdersApi.list).toHaveBeenLastCalledWith({
      status: 'RECIBIDA', plate: 'abc 123', page: 1, pageSize: 20,
    }));
    fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(workOrdersApi.list).toHaveBeenLastCalledWith({
      status: 'RECIBIDA', plate: 'abc 123', page: 2, pageSize: 20,
    }));
  });

  it('shows the API message and retries the request', async () => {
    workOrdersApi.list
      .mockRejectedValueOnce({ response: { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'Servicio temporalmente no disponible.' } } } })
      .mockResolvedValueOnce(emptyResult);
    renderPage();

    expect(await screen.findByText('Servicio temporalmente no disponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText(/aún no hay órdenes/i)).toBeInTheDocument();
    expect(workOrdersApi.list).toHaveBeenCalledTimes(2);
  });
});
