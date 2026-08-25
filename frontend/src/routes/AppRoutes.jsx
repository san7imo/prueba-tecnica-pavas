import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../layouts/AppShell.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { NewWorkOrderPage } from '../pages/NewWorkOrderPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { UsersPage } from '../pages/UsersPage.jsx';
import { WorkOrderDetailPage } from '../pages/WorkOrderDetailPage.jsx';
import { WorkOrdersPage } from '../pages/WorkOrdersPage.jsx';
import { AnonymousOnlyRoute, ProtectedRoute, RoleRoute } from './AuthGuards.jsx';

export const AppRoutes = () => (
  <Routes>
    <Route element={<AnonymousOnlyRoute />}>
      <Route path="login" element={<LoginPage />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<WorkOrdersPage />} />
        <Route path="orders/new" element={<NewWorkOrderPage />} />
        <Route path="orders/:id" element={<WorkOrderDetailPage />} />
        <Route element={<RoleRoute role="ADMIN" />}>
          <Route path="admin/users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);
