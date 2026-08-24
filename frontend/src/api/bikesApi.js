import { httpClient } from './httpClient.js';

export const bikesApi = {
  async create(payload) {
    const response = await httpClient.post('/bikes', payload);
    return response.data.data;
  },

  async list(plate = '') {
    const response = await httpClient.get('/bikes', {
      params: plate ? { plate } : undefined,
    });
    return response.data.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/bikes/${id}`);
    return response.data.data;
  },
};
