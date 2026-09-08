import { httpClient } from './httpClient.js';

export const bikesApi = {
  async create(payload) {
    const response = await httpClient.post('/bikes', payload);
    return response.data.data;
  },

  async list({
    plate = '',
    platePrefix = '',
    clientId = '',
    clientDocumentNumber = '',
    lifecycle = 'active',
    page = 1,
    pageSize = 20,
  } = {}) {
    const response = await httpClient.get('/bikes', {
      params: {
        ...(plate ? { plate } : {}),
        ...(platePrefix ? { platePrefix } : {}),
        ...(clientId ? { clientId } : {}),
        ...(clientDocumentNumber ? { clientDocumentNumber } : {}),
        ...(lifecycle !== 'active' ? { lifecycle } : {}),
        page,
        pageSize,
      },
    });
    return response.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/bikes/${id}`);
    return response.data.data;
  },

  async update(id, payload) {
    const response = await httpClient.patch(`/bikes/${id}`, payload);
    return response.data.data;
  },

  async changeOwner(id, payload) {
    const response = await httpClient.patch(`/bikes/${id}/owner`, payload);
    return response.data.data;
  },

  async remove(id, reason) {
    const response = await httpClient.delete(`/bikes/${id}`, { data: { reason } });
    return response.data.data;
  },

  async restore(id, reason) {
    const response = await httpClient.post(`/bikes/${id}/restore`, { reason });
    return response.data.data;
  },
};
