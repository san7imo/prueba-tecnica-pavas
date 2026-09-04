import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { workOrdersApi } from '../api/workOrdersApi.js';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { WORK_ORDER_STATUS_LABELS } from '../constants/workOrders.js';
import { useAuth } from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../utils/apiError.js';

const OPERATIONAL_QUEUES = [
  {
    status: 'RECIBIDA',
    description: 'Motos recién ingresadas que esperan iniciar diagnóstico.',
  },
  {
    status: 'DIAGNOSTICO',
    description: 'Servicios que requieren diagnóstico o volvieron para revisión.',
  },
  {
    status: 'EN_PROCESO',
    description: 'Reparaciones que se encuentran actualmente en ejecución.',
  },
  {
    status: 'LISTA',
    description: 'Motos terminadas que esperan validación y entrega.',
  },
];

export const DashboardPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const scope = isAdmin ? 'all' : 'mine';
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.all(
        OPERATIONAL_QUEUES.map(({ status }) => workOrdersApi.list({
          status,
          scope,
          page: 1,
          pageSize: 3,
        })),
      );
      setQueues(OPERATIONAL_QUEUES.map((queue, index) => ({
        ...queue,
        orders: results[index].data,
        totalItems: results[index].meta.totalItems,
      })));
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'No fue posible consultar las colas operativas.',
      ));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    // The effect keeps the operational queues synchronized with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  const openTotal = queues.reduce((total, queue) => total + queue.totalItems, 0);

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operación del taller</p>
          <h1 id="dashboard-title">Dashboard</h1>
          <p>{isAdmin
            ? 'Prioriza la recepción, el diagnóstico, la reparación y la entrega del taller.'
            : `Estas son las órdenes abiertas asignadas a ${user.name}.`}</p>
        </div>
        {isAdmin ? (
          <Link className="button button--primary button--prominent" to="/orders/new">
            <span aria-hidden="true">＋</span> Nueva orden
          </Link>
        ) : null}
      </div>

      <nav className="dashboard-shortcuts" aria-label="Accesos a órdenes">
        <Link className="button button--secondary" to={`/orders?scope=${scope}`}>
          {isAdmin ? 'Todas las órdenes' : 'Mis órdenes'}
        </Link>
        {isAdmin ? (
          <Link className="button button--secondary" to="/orders?scope=unassigned">
            Órdenes sin asignar
          </Link>
        ) : null}
      </nav>

      {loading ? (
        <div className="panel dashboard-state"><LoadingState message="Consultando colas operativas…" /></div>
      ) : null}
      {!loading && error ? (
        <div className="panel dashboard-state"><ErrorState message={error} onRetry={loadDashboard} /></div>
      ) : null}
      {!loading && !error ? (
        <>
          {openTotal === 0 ? (
            <div className="dashboard-empty" role="status">
              <strong>{isAdmin ? 'No hay órdenes abiertas en el taller.' : 'No tienes órdenes abiertas asignadas.'}</strong>
              <span>{isAdmin ? 'Las nuevas recepciones aparecerán en estas colas.' : 'Un administrador puede asignarte una orden desde la cola general.'}</span>
            </div>
          ) : null}
          <div className="dashboard-grid">
            {queues.map((queue) => (
              <article className="panel queue-card" key={queue.status}>
                <div className="queue-card__heading">
                  <div>
                    <p className="card-label">{WORK_ORDER_STATUS_LABELS[queue.status]}</p>
                    <strong className="queue-card__count">{queue.totalItems}</strong>
                  </div>
                  <Link
                    className="text-link"
                    to={`/orders?scope=${scope}&status=${queue.status}`}
                    aria-label={`Abrir cola ${WORK_ORDER_STATUS_LABELS[queue.status]}`}
                  >
                    Abrir cola <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <p className="queue-card__description">{queue.description}</p>
                {queue.orders.length > 0 ? (
                  <ul className="queue-preview" aria-label={`Primeras órdenes en ${WORK_ORDER_STATUS_LABELS[queue.status]}`}>
                    {queue.orders.map((order) => (
                      <li key={order.id}>
                        <Link to={`/orders/${order.id}`}>
                          <span><strong className="plate">{order.bike.plate}</strong><small>Orden #{order.id}</small></span>
                          <span><strong>{order.bike.client.name}</strong><small>{order.assignedMechanic?.name ?? 'Sin asignar'}</small></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="queue-card__empty">Sin órdenes en esta etapa.</p>}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};
