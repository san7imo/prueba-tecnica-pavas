import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditApi } from '../src/api/auditApi.js';
import { AuditEventDetailPage } from '../src/pages/AuditEventDetailPage.jsx';
import { AuditEventsPage } from '../src/pages/AuditEventsPage.jsx';
import { renderWithAuth } from './testUtils.jsx';

vi.mock('../src/api/auditApi.js', () => ({
  auditApi: { list: vi.fn(), getById: vi.fn() },
}));

const auditEvent = {
  id: 41,
  entityType: 'WORK_ORDER',
  entityId: 7,
  action: 'REOPENED',
  actor: { id: 1, name: 'Ada Admin' },
  beforeData: { id: '7', status: 'ENTREGADA' },
  afterData: { id: '7', status: 'DIAGNOSTICO' },
  metadata: { reopenType: 'WARRANTY' },
  reason: 'Persiste la falla original.',
  createdAt: '2026-09-03T15:00:00.000Z',
};

const emptyResult = {
  data: [],
  meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
};

const listResult = {
  data: [auditEvent],
  meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

const renderList = () => renderWithAuth(
  <MemoryRouter><AuditEventsPage /></MemoryRouter>,
);

describe('Audit pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditApi.list.mockResolvedValue(listResult);
    auditApi.getById.mockResolvedValue(auditEvent);
  });

  it('lists safe audit context and links to immutable event detail', async () => {
    renderList();

    expect(screen.getByText(/consultando eventos de auditoría/i)).toBeInTheDocument();
    expect(await screen.findByText('Reapertura')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /orden de trabajo.*id 7/i }))
      .toBeInTheDocument();
    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.getByText('Persiste la falla original.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver evento de auditoría 41/i }))
      .toHaveAttribute('href', '/admin/audit/41');
    expect(screen.getByRole('region', { name: /tabla de eventos de auditoría/i }))
      .toHaveAttribute('tabindex', '0');
  });

  it('applies bounded server filters and resets pagination', async () => {
    renderList();
    await screen.findByText('Reapertura');

    fireEvent.change(screen.getByLabelText('Entidad'), { target: { value: 'WORK_ORDER' } });
    fireEvent.change(screen.getByLabelText('ID de entidad'), { target: { value: ' 7 ' } });
    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'REOPENED' } });
    fireEvent.change(screen.getByLabelText('ID del actor'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-03' } });
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));

    await waitFor(() => expect(auditApi.list).toHaveBeenLastCalledWith({
      entityType: 'WORK_ORDER',
      entityId: '7',
      action: 'REOPENED',
      actorUserId: '1',
      dateFrom: expect.stringMatching(/^2026-09-0[12]T/),
      dateTo: expect.stringMatching(/^2026-09-0[34]T/),
      page: 1,
      pageSize: 20,
    }));
  });

  it('rejects invalid local filters before making another request', async () => {
    renderList();
    await screen.findByText('Reapertura');

    fireEvent.change(screen.getByLabelText('ID del actor'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /aplicar filtros/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/entero positivo/i);
    expect(auditApi.list).toHaveBeenCalledTimes(1);
  });

  it('shows list errors with retry and an empty filtered result', async () => {
    auditApi.list
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Auditoría no disponible.' } } } })
      .mockResolvedValueOnce(emptyResult);
    renderList();

    expect(await screen.findByText('Auditoría no disponible.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText(/aún no hay eventos de auditoría/i)).toBeInTheDocument();
  });

  it('shows immutable before, after and metadata snapshots in detail', async () => {
    renderWithAuth(
      <MemoryRouter initialEntries={['/admin/audit/41']}>
        <Routes><Route path="/admin/audit/:id" element={<AuditEventDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Reapertura' })).toBeInTheDocument();
    expect(auditApi.getById).toHaveBeenCalledWith('41');
    expect(screen.getByText(/orden de trabajo #7/i)).toBeInTheDocument();
    expect(screen.getByText(/ada admin · usuario #1/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Antes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Después' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Metadatos' })).toBeInTheDocument();
    expect(screen.getByText(/"status": "ENTREGADA"/)).toBeInTheDocument();
    expect(screen.getByText(/"reopenType": "WARRANTY"/)).toBeInTheDocument();
  });

  it('reports a detail error and retries the same immutable event', async () => {
    auditApi.getById
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Evento temporalmente no disponible.' } } },
      })
      .mockResolvedValueOnce(auditEvent);
    renderWithAuth(
      <MemoryRouter initialEntries={['/admin/audit/41']}>
        <Routes><Route path="/admin/audit/:id" element={<AuditEventDetailPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Evento temporalmente no disponible.'))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: 'Reapertura' }))
      .toBeInTheDocument();
    expect(auditApi.getById).toHaveBeenCalledTimes(2);
  });
});
