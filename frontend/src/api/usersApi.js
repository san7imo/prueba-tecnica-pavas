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

  async changeRole(id, role) {
    const response = await httpClient.patch(`/users/${id}/role`, { role });
    return response.data.data;
  },

  async changeActive(id, active) {
    const response = await httpClient.patch(`/users/${id}/active`, { active });
    return response.data.data;
  },
};
