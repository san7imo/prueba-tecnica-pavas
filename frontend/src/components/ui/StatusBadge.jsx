import { WORK_ORDER_STATUS_LABELS } from '../../constants/workOrders.js';

export const StatusBadge = ({ status }) => (
  <span className={`status-badge status-badge--${status.toLowerCase()}`}>
    {WORK_ORDER_STATUS_LABELS[status] ?? status}
  </span>
);
