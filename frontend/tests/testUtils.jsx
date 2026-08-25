import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { AuthContext } from '../src/context/AuthContextValue.js';

export const adminUser = { id: 1, name: 'Ada Admin', email: 'ada@pavas.test', role: 'ADMIN', active: true };
export const mechanicUser = { id: 2, name: 'Mauro Mecánico', email: 'mauro@pavas.test', role: 'MECANICO', active: true };

export const authValue = (user = adminUser, overrides = {}) => ({
  user,
  accessToken: 'access-token',
  isAuthenticated: true,
  isLoading: false,
  sessionMessage: '',
  login: vi.fn(),
  logout: vi.fn(),
  ...overrides,
});

export const renderWithAuth = (ui, options = {}) => {
  const value = options.auth ?? authValue();
  return render(<AuthContext.Provider value={value}>{ui}</AuthContext.Provider>);
};
