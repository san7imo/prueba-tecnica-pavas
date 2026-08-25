import { useCallback, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api/authApi.js';
import {
  clearSession,
  configureRefreshHandler,
  establishSession,
  getSession,
  refreshAccessSession,
  subscribeToSession,
} from '../features/auth/authSession.js';
import { AuthContext } from './AuthContextValue.js';

export const AuthProvider = ({ children }) => {
  const initialSession = getSession();
  const [user, setUser] = useState(initialSession?.user ?? null);
  const [accessToken, setAccessToken] = useState(initialSession?.accessToken ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    configureRefreshHandler(authApi.refresh);
    const unsubscribe = subscribeToSession((nextSession, message) => {
      if (!mounted) return;
      setUser(nextSession?.user ?? null);
      setAccessToken(nextSession?.accessToken ?? null);
      setSessionMessage(message);
    });

    refreshAccessSession()
      .catch(() => clearSession())
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const nextSession = await authApi.login(credentials);
    establishSession(nextSession);
    return nextSession.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local session cleanup must not depend on network availability.
    } finally {
      clearSession();
    }
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    sessionMessage,
    login,
    logout,
  }), [accessToken, isLoading, login, logout, sessionMessage, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
