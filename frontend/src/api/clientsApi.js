import { httpClient } from './httpClient.js';

export const clientsApi = {
  async create(payload) {
    const response = await httpClient.post('/clients', payload);
    return response.data.data;
  },

  async list(search = '') {
    const response = await httpClient.get('/clients', {
      params: search ? { search } : undefined,
    });
    return response.data.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/clients/${id}`);
    return response.data.data;
  },
};
