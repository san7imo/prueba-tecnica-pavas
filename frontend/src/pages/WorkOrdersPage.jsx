import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { OrderFilters } from '../features/workOrders/components/OrderFilters.jsx';
import { OrderTable } from '../features/workOrders/components/OrderTable.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useWorkOrders } from '../features/workOrders/hooks/useWorkOrders.js';
import { useAuth } from '../hooks/useAuth.js';

const EMPTY_FILTERS = { status: '', plate: '' };

export const WorkOrdersPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [scope, setScope] = useState(isAdmin ? 'all' : 'mine');
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const filters = useMemo(
    () => ({ ...applied, scope, page, pageSize: 20 }),
    [applied, page, scope],
  );
  const { orders, meta, loading, error, retry } = useWorkOrders(filters);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied({ status: draft.status, plate: draft.plate.trim() });
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const hasFilters = Boolean(applied.status || applied.plate);

  const changeScope = (nextScope) => {
    setScope(nextScope);
    setPage(1);
  };

  return (
    <section aria-labelledby="orders-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operación del taller</p>
          <h1 id="orders-title">{isAdmin ? 'Órdenes de trabajo' : 'Mis órdenes'}</h1>
          <p>{isAdmin
            ? 'Consulta el avance, los responsables y el valor acumulado de cada servicio.'
            : 'Consulta y trabaja únicamente las órdenes asignadas a ti.'}</p>
        </div>
        {isAdmin ? <Link className="button button--primary button--prominent" to="/orders/new">
          <span aria-hidden="true">＋</span> Nueva orden
        </Link> : null}
      </div>

      {isAdmin ? (
        <div className="scope-switch" aria-label="Vista de asignación">
          <button className="button button--secondary" type="button" aria-pressed={scope === 'all'} onClick={() => changeScope('all')} disabled={loading}>Todas</button>
          <button className="button button--secondary" type="button" aria-pressed={scope === 'unassigned'} onClick={() => changeScope('unassigned')} disabled={loading}>Sin asignar</button>
        </div>
      ) : <p className="scope-summary" role="status">Vista personal: sólo órdenes asignadas a {user.name}.</p>}

      <div className="panel filters-panel">
        <OrderFilters
          draft={draft}
          onChange={setDraft}
          onSubmit={applyFilters}
          onClear={clearFilters}
          disabled={loading}
        />
      </div>

      <div className="panel orders-panel">
        {loading ? <LoadingState message="Consultando órdenes…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={retry} /> : null}
        {!loading && !error && orders.length === 0 ? (
          <EmptyState
            title={hasFilters
              ? 'No hay resultados para estos filtros'
              : scope === 'unassigned'
                ? 'No hay órdenes sin asignar'
                : isAdmin ? 'Aún no hay órdenes' : 'No tienes órdenes asignadas'}
            message={hasFilters
              ? 'Ajusta el estado o la placa e inténtalo nuevamente.'
              : scope === 'unassigned'
                ? 'Todas las órdenes actuales ya tienen un responsable.'
                : isAdmin
                  ? 'Crea la primera orden para iniciar la operación del taller.'
                  : 'Cuando un administrador te asigne trabajo, aparecerá aquí.'}
            action={hasFilters ? (
              <button className="button button--secondary" type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : isAdmin ? (
              <Link className="button button--primary" to="/orders/new">Crear primera orden</Link>
            ) : null}
          />
        ) : null}
        {!loading && !error && orders.length > 0 ? (
          <>
            <OrderTable orders={orders} />
            <Pagination meta={meta} onPageChange={setPage} disabled={loading} />
          </>
        ) : null}
      </div>
    </section>
  );
};
