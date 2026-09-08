import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { OrderFilters } from '../features/workOrders/components/OrderFilters.jsx';
import { OrderTable } from '../features/workOrders/components/OrderTable.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useWorkOrders } from '../features/workOrders/hooks/useWorkOrders.js';
import { useAuth } from '../hooks/useAuth.js';
import { WORK_ORDER_STATUSES } from '../constants/workOrders.js';

const EMPTY_FILTERS = { status: '', plate: '', clientDocumentNumber: '' };
const ADMIN_SCOPES = ['all', 'unassigned'];

const positivePage = (value) => {
  if (!/^[1-9]\d*$/.test(value ?? '')) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
};

const positiveId = (value) => {
  if (!/^[1-9]\d*$/.test(value ?? '')) return '';
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : '';
};

export const WorkOrdersPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedScope = searchParams.get('scope');
  const requestedStatus = searchParams.get('status');
  const requestedAssignee = positiveId(searchParams.get('assignedMechanicId'));
  const initialFilters = {
    status: WORK_ORDER_STATUSES.includes(requestedStatus) ? requestedStatus : '',
    plate: searchParams.get('plate') ?? '',
    clientDocumentNumber: searchParams.get('clientDocumentNumber') ?? '',
  };
  const [scope, setScope] = useState(
    isAdmin && ADMIN_SCOPES.includes(requestedScope) ? requestedScope : isAdmin ? 'all' : 'mine',
  );
  const [draft, setDraft] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [page, setPage] = useState(positivePage(searchParams.get('page')));
  const [assignedMechanicId, setAssignedMechanicId] = useState(
    isAdmin ? requestedAssignee : '',
  );
  const filters = useMemo(
    () => ({
      ...applied,
      scope,
      ...(assignedMechanicId ? { assignedMechanicId } : {}),
      page,
      pageSize: 20,
    }),
    [applied, assignedMechanicId, page, scope],
  );
  const { orders, meta, loading, error, retry } = useWorkOrders(filters);

  const updateLocation = ({
    nextScope = scope,
    nextFilters = applied,
    nextAssignedMechanicId = assignedMechanicId,
    nextPage = page,
  } = {}) => {
    const next = new URLSearchParams();
    next.set('scope', nextScope);
    if (nextFilters.status) next.set('status', nextFilters.status);
    if (nextFilters.plate) next.set('plate', nextFilters.plate);
    if (nextFilters.clientDocumentNumber) {
      next.set('clientDocumentNumber', nextFilters.clientDocumentNumber);
    }
    if (isAdmin && nextAssignedMechanicId) {
      next.set('assignedMechanicId', String(nextAssignedMechanicId));
    }
    if (nextPage > 1) next.set('page', String(nextPage));
    setSearchParams(next, { replace: true });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    const nextFilters = {
      status: draft.status,
      plate: draft.plate.trim(),
      clientDocumentNumber: draft.clientDocumentNumber.trim(),
    };
    setPage(1);
    setApplied(nextFilters);
    updateLocation({ nextFilters, nextPage: 1 });
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setAssignedMechanicId('');
    setPage(1);
    updateLocation({
      nextFilters: EMPTY_FILTERS,
      nextAssignedMechanicId: '',
      nextPage: 1,
    });
  };

  const hasFilters = Boolean(
    applied.status ||
    applied.plate ||
    applied.clientDocumentNumber ||
    assignedMechanicId,
  );

  const changeScope = (nextScope) => {
    setScope(nextScope);
    setAssignedMechanicId('');
    setPage(1);
    updateLocation({ nextScope, nextAssignedMechanicId: '', nextPage: 1 });
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    updateLocation({ nextPage });
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

      {isAdmin && assignedMechanicId ? (
        <p className="scope-summary actionable-summary" role="status">
          <span>Mostrando las órdenes del mecánico seleccionado desde Usuarios.</span>
          <button className="text-button" type="button" onClick={clearFilters}>
            Mostrar todas las órdenes
          </button>
        </p>
      ) : null}

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
              ? 'Ajusta la cédula, el estado o la placa e inténtalo nuevamente.'
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
            <Pagination meta={meta} onPageChange={changePage} disabled={loading} />
          </>
        ) : null}
      </div>
    </section>
  );
};
