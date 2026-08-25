import { authHttpClient, httpClient } from './httpClient.js';

export const authApi = {
  async login(credentials) {
    const response = await authHttpClient.post('/auth/login', credentials);
    return response.data.data;
  },

  async refresh() {
    const response = await authHttpClient.post('/auth/refresh');
    return response.data.data;
  },

  async logout() {
    const response = await authHttpClient.post('/auth/logout');
    return response.data.data;
  },

  async me() {
    const response = await httpClient.get('/auth/me');
    return response.data.data;
  },
};
