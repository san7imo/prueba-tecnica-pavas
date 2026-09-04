import { httpClient } from './httpClient.js';

export const auditApi = {
  async list({
    entityType = '',
    entityId = '',
    action = '',
    actorUserId = '',
    dateFrom = '',
    dateTo = '',
    page = 1,
    pageSize = 20,
  } = {}) {
    const response = await httpClient.get('/audit-events', {
      params: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(action ? { action } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        pageSize,
      },
    });
    return response.data;
  },

  async getById(id) {
    const response = await httpClient.get(`/audit-events/${id}`);
    return response.data.data;
  },
};
