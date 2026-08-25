import { AuthProvider } from './context/AuthContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

export const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);
