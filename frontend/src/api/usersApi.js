import { httpClient } from './httpClient.js';

export const usersApi = {
  async list() {
    const response = await httpClient.get('/users');
    return response.data.data;
  },

  async create(payload) {
    const response = await httpClient.post('/auth/register', payload);
    return response.data.data;
  },

  async changeRole(id, payload) {
    const response = await httpClient.patch(`/users/${id}/role`, payload);
    return response.data.data;
  },

  async changeActive(id, payload) {
    const response = await httpClient.patch(`/users/${id}/active`, payload);
    return response.data.data;
  },
};
