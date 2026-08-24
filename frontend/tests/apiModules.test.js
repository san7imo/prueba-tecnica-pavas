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
    httpClient.get.mockResolvedValueOnce({ data: { data: [{ id: 2 }] } });

    await expect(clientsApi.create({ name: 'Ana', phone: '300' })).resolves.toEqual({ id: 1 });
    await expect(bikesApi.list('ABC')).resolves.toEqual([{ id: 2 }]);
    expect(httpClient.get).toHaveBeenCalledWith('/bikes', { params: { plate: 'ABC' } });
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
    await workOrdersApi.updateStatus(7, 'DIAGNOSTICO');

    expect(httpClient.patch).toHaveBeenCalledWith('/work-orders/7/status', {
      toStatus: 'DIAGNOSTICO',
      note: null,
    });
  });
});
