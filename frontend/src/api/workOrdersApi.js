import { httpClient } from './httpClient.js';

export const workOrdersApi = {
  async create(payload) {
    const response = await httpClient.post('/work-orders', payload);
    return response.data.data;
  },

  async list({ status = '', plate = '', bikeId = '', page = 1, pageSize = 20 } = {}) {
    const response = await httpClient.get('/work-orders', {
      params: {
        ...(status ? { status } : {}),
        ...(plate ? { plate } : {}),
        ...(bikeId ? { bikeId } : {}),
        page,
        pageSize,
      },
    });
    return response.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/work-orders/${id}`);
    return response.data.data;
  },

  async addItem(id, payload) {
    const response = await httpClient.post(`/work-orders/${id}/items`, payload);
    return response.data.data;
  },

  async deleteItem(itemId) {
    const response = await httpClient.delete(`/work-orders/items/${itemId}`);
    return response.data.data;
  },

  async updateStatus(id, toStatus, note = null) {
    const response = await httpClient.patch(`/work-orders/${id}/status`, {
      toStatus,
      note: note?.trim() || null,
    });
    return response.data.data;
  },

  async getHistory(id, { page = 1, pageSize = 20 } = {}) {
    const response = await httpClient.get(`/work-orders/${id}/history`, {
      params: { page, pageSize },
    });
    return response.data;
  },
};
