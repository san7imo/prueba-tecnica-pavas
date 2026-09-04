import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bikesApi } from '../src/api/bikesApi.js';
import { clientsApi } from '../src/api/clientsApi.js';
import { httpClient } from '../src/api/httpClient.js';
import { workOrdersApi } from '../src/api/workOrdersApi.js';

vi.mock('../src/api/httpClient.js', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('feature API modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps Client and Bike envelopes', async () => {
    httpClient.post.mockResolvedValueOnce({ data: { data: { id: 1 } } });
    httpClient.get.mockResolvedValueOnce({ data: { data: [{ id: 2 }], meta: { page: 1 } } });

    await expect(clientsApi.create({ name: 'Ana', phone: '300' })).resolves.toEqual({ id: 1 });
    await expect(bikesApi.list({ plate: 'ABC' })).resolves.toEqual({ data: [{ id: 2 }], meta: { page: 1 } });
    expect(httpClient.get).toHaveBeenCalledWith('/bikes', { params: { plate: 'ABC', page: 1, pageSize: 20 } });
  });

  it('sends lifecycle mutations and owner changes with their reasons', async () => {
    httpClient.patch.mockResolvedValue({ data: { data: { id: 2 } } });
    httpClient.delete.mockResolvedValue({ data: { data: { id: 1 } } });
    httpClient.post.mockResolvedValue({ data: { data: { id: 2 } } });

    await bikesApi.changeOwner(2, { clientId: 8, reason: 'Venta registrada.' });
    await clientsApi.remove(1, 'Solicitud del cliente.');
    await bikesApi.restore(2, 'Regresa al taller.');

    expect(httpClient.patch).toHaveBeenCalledWith('/bikes/2/owner', { clientId: 8, reason: 'Venta registrada.' });
    expect(httpClient.delete).toHaveBeenCalledWith('/clients/1', { data: { reason: 'Solicitud del cliente.' } });
    expect(httpClient.post).toHaveBeenCalledWith('/bikes/2/restore', { reason: 'Regresa al taller.' });
  });

  it('sends only active list filters with pagination', async () => {
    httpClient.get.mockResolvedValue({ data: { data: [], meta: {} } });
    await workOrdersApi.list({ status: '', plate: 'ABC', page: 2, pageSize: 20 });

    expect(httpClient.get).toHaveBeenCalledWith('/work-orders', {
      params: { plate: 'ABC', page: 2, pageSize: 20 },
    });
  });

  it('keeps the status body compatible with the approved Phase 2 shape', async () => {
    httpClient.patch.mockResolvedValue({ data: { data: { id: 7, status: 'DIAGNOSTICO' } } });
    await workOrdersApi.updateStatus(7, 'DIAGNOSTICO', '  Inicio de revisión  ');

    expect(httpClient.patch).toHaveBeenCalledWith('/work-orders/7/status', {
      toStatus: 'DIAGNOSTICO',
      note: 'Inicio de revisión',
    });
  });

  it('sends ownership scopes and normalized assignment changes', async () => {
    httpClient.get.mockResolvedValue({ data: { data: [], meta: {} } });
    httpClient.patch.mockResolvedValue({
      data: { data: { id: 7, assignedMechanicId: 12 } },
    });

    await workOrdersApi.list({
      scope: 'mine',
      assignedMechanicId: 12,
      page: 2,
      pageSize: 10,
    });
    await workOrdersApi.changeAssignment(7, 12, '  Redistribución de carga  ');

    expect(httpClient.get).toHaveBeenCalledWith('/work-orders', {
      params: { scope: 'mine', assignedMechanicId: 12, page: 2, pageSize: 10 },
    });
    expect(httpClient.patch).toHaveBeenCalledWith('/work-orders/7/assignment', {
      mechanicId: 12,
      reason: 'Redistribución de carga',
    });
  });

  it('sends the dedicated reopening contract with a normalized reason', async () => {
    httpClient.post.mockResolvedValue({
      data: { data: { id: 7, status: 'DIAGNOSTICO' } },
    });

    await expect(workOrdersApi.reopen(
      7,
      'SAME_ISSUE',
      '  Persiste la falla original.  ',
    )).resolves.toEqual({ id: 7, status: 'DIAGNOSTICO' });

    expect(httpClient.post).toHaveBeenCalledWith('/work-orders/7/reopen', {
      type: 'SAME_ISSUE',
      reason: 'Persiste la falla original.',
    });
  });

  it('requests paginated status history newest-first as provided by the API', async () => {
    httpClient.get.mockResolvedValue({ data: { data: [], meta: { page: 2 } } });
    await workOrdersApi.getHistory(7, { page: 2, pageSize: 20 });

    expect(httpClient.get).toHaveBeenCalledWith('/work-orders/7/history', {
      params: { page: 2, pageSize: 20 },
    });
  });
});
