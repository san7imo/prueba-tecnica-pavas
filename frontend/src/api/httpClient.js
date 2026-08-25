import axios from 'axios';

import {
  clearSession,
  getAccessToken,
  refreshAccessSession,
} from '../features/auth/authSession.js';

const commonConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
};

export const authHttpClient = axios.create(commonConfig);

export const httpClient = axios.create(commonConfig);

httpClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || !originalRequest || originalRequest._authRetried) {
      throw error;
    }

    originalRequest._authRetried = true;
    try {
      const refreshedSession = await refreshAccessSession();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${refreshedSession.accessToken}`;
      return httpClient(originalRequest);
    } catch (refreshError) {
      clearSession('Tu sesión expiró. Inicia sesión nuevamente.');
      throw refreshError;
    }
  },
);
