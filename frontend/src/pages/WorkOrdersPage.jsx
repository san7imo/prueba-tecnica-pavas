import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { OrderFilters } from '../features/workOrders/components/OrderFilters.jsx';
import { OrderTable } from '../features/workOrders/components/OrderTable.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useWorkOrders } from '../features/workOrders/hooks/useWorkOrders.js';

const EMPTY_FILTERS = { status: '', plate: '' };

export const WorkOrdersPage = () => {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const filters = useMemo(
    () => ({ ...applied, page, pageSize: 20 }),
    [applied, page],
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

  return (
    <section aria-labelledby="orders-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operación del taller</p>
          <h1 id="orders-title">Órdenes de trabajo</h1>
          <p>Consulta el avance, los vehículos y el valor acumulado de cada servicio.</p>
        </div>
        <Link className="button button--primary button--prominent" to="/orders/new">
          <span aria-hidden="true">＋</span> Nueva orden
        </Link>
      </div>

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
            title={hasFilters ? 'No hay resultados para estos filtros' : 'Aún no hay órdenes'}
            message={hasFilters ? 'Ajusta el estado o la placa e inténtalo nuevamente.' : 'Crea la primera orden para iniciar la operación del taller.'}
            action={hasFilters ? (
              <button className="button button--secondary" type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : (
              <Link className="button button--primary" to="/orders/new">Crear primera orden</Link>
            )}
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
