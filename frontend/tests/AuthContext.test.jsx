import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '../src/api/authApi.js';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { useAuth } from '../src/hooks/useAuth.js';
import { mechanicUser } from './testUtils.jsx';

vi.mock('../src/api/authApi.js', () => ({
  authApi: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));

const SessionProbe = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  if (isLoading) return <p>bootstrapping</p>;
  if (!isAuthenticated) return <p>anonymous</p>;
  return <><p>{user.name}</p><button type="button" onClick={logout}>logout</button></>;
};

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores the user and access token through the refresh cookie flow', async () => {
    authApi.refresh.mockResolvedValue({ user: mechanicUser, accessToken: 'fresh-access' });
    render(<AuthProvider><SessionProbe /></AuthProvider>);

    expect(screen.getByText('bootstrapping')).toBeInTheDocument();
    expect(await screen.findByText(mechanicUser.name)).toBeInTheDocument();
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('finishes bootstrap anonymously when refresh is unavailable', async () => {
    authApi.refresh.mockRejectedValue({ response: { status: 401 } });
    render(<AuthProvider><SessionProbe /></AuthProvider>);

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
  });

  it('always clears local session state even when the logout request fails', async () => {
    authApi.refresh.mockResolvedValue({ user: mechanicUser, accessToken: 'fresh-access' });
    authApi.logout.mockRejectedValue(new Error('network unavailable'));
    render(<AuthProvider><SessionProbe /></AuthProvider>);
    await screen.findByText(mechanicUser.name);

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });
});
