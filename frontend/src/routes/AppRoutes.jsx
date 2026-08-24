import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../layouts/AppShell.jsx';
import { NewWorkOrderPage } from '../pages/NewWorkOrderPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { WorkOrderDetailPage } from '../pages/WorkOrderDetailPage.jsx';
import { WorkOrdersPage } from '../pages/WorkOrdersPage.jsx';

export const AppRoutes = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/orders" replace />} />
      <Route path="orders" element={<WorkOrdersPage />} />
      <Route path="orders/new" element={<NewWorkOrderPage />} />
      <Route path="orders/:id" element={<WorkOrderDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);
