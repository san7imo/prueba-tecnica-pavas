import { useCallback, useEffect, useState } from 'react';

import { workOrdersApi } from '../../../api/workOrdersApi.js';
import { WORK_ORDER_STATUS_LABELS } from '../../../constants/workOrders.js';
import { getApiError } from '../../../utils/apiError.js';
import { formatDateTime } from '../../../utils/formatters.js';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { Pagination } from './Pagination.jsx';

const PAGE_SIZE = 20;

export const HistoryTimeline = ({ workOrderId }) => {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await workOrdersApi.getHistory(workOrderId, { page, pageSize: PAGE_SIZE });
      setRecords(result.data);
      setMeta(result.meta);
    } catch (requestError) {
      setError(getApiError(requestError, 'No fue posible consultar el historial.'));
    } finally {
      setLoading(false);
    }
  }, [page, workOrderId]);

  useEffect(() => {
    // The effect synchronizes the selected history page with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  return (
    <section className="panel history-panel" aria-labelledby="history-title">
      <div className="section-heading section-heading--compact">
        <div><h2 id="history-title">Historial de estados</h2><p>Cambios auditados, del más reciente al más antiguo.</p></div>
      </div>
      {loading ? <LoadingState message="Cargando historial…" /> : null}
      {!loading && error ? <ErrorState message={error.message} onRetry={loadHistory} /> : null}
      {!loading && !error && records.length === 0 ? <EmptyState title="Sin historial" message="Los cambios de estado aparecerán aquí." /> : null}
      {!loading && !error && records.length > 0 ? (
        <>
          <ol className="history-timeline">
            {records.map((record) => (
              <li key={record.id}>
                <span className="history-timeline__marker" aria-hidden="true" />
                <div className="history-timeline__content">
                  <div className="history-timeline__heading">
                    <strong>{record.fromStatus ? WORK_ORDER_STATUS_LABELS[record.fromStatus] : 'Orden creada'} → {WORK_ORDER_STATUS_LABELS[record.toStatus]}</strong>
                    <time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time>
                  </div>
                  <p>Cambio realizado por <strong>{record.changedBy.name}</strong></p>
                  {record.note ? <blockquote>{record.note}</blockquote> : <small>Sin nota</small>}
                </div>
              </li>
            ))}
          </ol>
          <Pagination meta={meta} onPageChange={setPage} disabled={loading} label="eventos" singularLabel="evento" ariaLabel="Paginación del historial" />
        </>
      ) : null}
    </section>
  );
};
