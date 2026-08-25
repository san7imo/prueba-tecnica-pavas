import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '../components/ui/LoadingState.jsx';
import { useAuth } from '../hooks/useAuth.js';

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState message="Restaurando sesión…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
};

export const AnonymousOnlyRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingState message="Restaurando sesión…" />;
  return isAuthenticated ? <Navigate to="/orders" replace /> : <Outlet />;
};

export const RoleRoute = ({ role }) => {
  const { user } = useAuth();
  return user?.role === role ? <Outlet /> : <Navigate to="/orders" replace />;
};
