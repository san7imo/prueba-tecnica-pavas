import { httpClient } from './httpClient.js';

export const clientsApi = {
  async create(payload) {
    const response = await httpClient.post('/clients', payload);
    return response.data.data;
  },

  async list({
    documentNumber = '',
    search = '',
    lifecycle = 'active',
    page = 1,
    pageSize = 20,
  } = {}) {
    const response = await httpClient.get('/clients', {
      params: {
        ...(documentNumber ? { documentNumber } : {}),
        ...(search ? { search } : {}),
        ...(lifecycle !== 'active' ? { lifecycle } : {}),
        page,
        pageSize,
      },
    });
    return response.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/clients/${id}`);
    return response.data.data;
  },

  async update(id, payload) {
    const response = await httpClient.patch(`/clients/${id}`, payload);
    return response.data.data;
  },

  async remove(id, reason) {
    const response = await httpClient.delete(`/clients/${id}`, { data: { reason } });
    return response.data.data;
  },

  async restore(id, payload) {
    const response = await httpClient.post(`/clients/${id}/restore`, payload);
    return response.data.data;
  },
};
