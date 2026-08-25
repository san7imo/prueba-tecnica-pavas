import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workOrdersApi } from '../src/api/workOrdersApi.js';
import { HistoryTimeline } from '../src/features/workOrders/components/HistoryTimeline.jsx';

vi.mock('../src/api/workOrdersApi.js', () => ({ workOrdersApi: { getHistory: vi.fn() } }));

const history = [
  { id: 2, fromStatus: 'RECIBIDA', toStatus: 'DIAGNOSTICO', note: 'Se revisó transmisión', createdAt: '2026-08-24T16:00:00.000Z', changedBy: { id: 2, name: 'Mauro Mecánico' } },
  { id: 1, fromStatus: null, toStatus: 'RECIBIDA', note: null, createdAt: '2026-08-24T15:00:00.000Z', changedBy: { id: 1, name: 'Ada Admin' } },
];

describe('HistoryTimeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders newest-first audit data, actor, note and a friendly initial event', async () => {
    workOrdersApi.getHistory.mockResolvedValue({ data: history, meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } });
    render(<HistoryTimeline workOrderId="7" />);

    expect(screen.getByText(/cargando historial/i)).toBeInTheDocument();
    const timeline = await screen.findByRole('list');
    const events = within(timeline).getAllByRole('listitem');
    expect(events[0]).toHaveTextContent('Recibida → Diagnóstico');
    expect(events[0]).toHaveTextContent('Mauro Mecánico');
    expect(events[0]).toHaveTextContent('Se revisó transmisión');
    expect(events[1]).toHaveTextContent('Orden creada → Recibida');
    expect(events[1]).toHaveTextContent('Sin nota');
  });

  it('requests the next backend page with the canonical page size', async () => {
    workOrdersApi.getHistory
      .mockResolvedValueOnce({ data: history, meta: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 } })
      .mockResolvedValueOnce({ data: [history[1]], meta: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 } });
    render(<HistoryTimeline workOrderId="7" />);
    await screen.findByText(/recibida → diagnóstico/i);

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(workOrdersApi.getHistory).toHaveBeenLastCalledWith('7', { page: 2, pageSize: 20 }));
  });

  it('shows an empty state and a retryable error state', async () => {
    workOrdersApi.getHistory.mockRejectedValueOnce({ response: { status: 500, data: { error: { message: 'Historial no disponible.' } } } })
      .mockResolvedValueOnce({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
    render(<HistoryTimeline workOrderId="7" />);

    expect(await screen.findByText('Historial no disponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: /sin historial/i })).toBeInTheDocument();
  });
});
