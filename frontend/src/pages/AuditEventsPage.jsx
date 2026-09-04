import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { auditApi } from '../api/auditApi.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPES,
} from '../constants/audit.js';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { getApiErrorMessage } from '../utils/apiError.js';
import { formatDateTime } from '../utils/formatters.js';

const EMPTY_FILTERS = {
  entityType: '',
  entityId: '',
  action: '',
  actorUserId: '',
  dateFrom: '',
  dateTo: '',
};

const asBoundaryDate = (date, endOfDay = false) => {
  if (!date) return '';
  return new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}`).toISOString();
};

const normalizedFilters = (filters) => ({
  entityType: filters.entityType,
  entityId: filters.entityId.trim(),
  action: filters.action,
  actorUserId: filters.actorUserId.trim(),
  dateFrom: asBoundaryDate(filters.dateFrom),
  dateTo: asBoundaryDate(filters.dateTo, true),
});

const validateFilters = (filters) => {
  for (const [field, label] of [
    ['entityId', 'El ID de entidad'],
    ['actorUserId', 'El ID del actor'],
  ]) {
    const value = filters[field].trim();
    if (value && !/^[1-9]\d*$/.test(value)) return `${label} debe ser un entero positivo.`;
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return 'La fecha final no puede ser anterior a la fecha inicial.';
  }
  return '';
};

export const AuditEventsPage = () => {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const filters = useMemo(() => ({
    ...normalizedFilters(applied),
    page,
    pageSize: 20,
  }), [applied, page]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await auditApi.list(filters);
      setEvents(result.data);
      setMeta(result.meta);
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'No fue posible consultar la auditoría.',
      ));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // The effect synchronizes the audit view with its bounded server filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
  }, [loadEvents]);

  const applyFilters = (event) => {
    event.preventDefault();
    const validationMessage = validateFilters(draft);
    setFilterError(validationMessage);
    if (validationMessage) return;
    setApplied({ ...draft });
    setPage(1);
  };

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFilterError('');
    setPage(1);
  };

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <section aria-labelledby="audit-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Trazabilidad del negocio</p>
          <h1 id="audit-title">Auditoría</h1>
          <p>Consulta quién realizó cada cambio, cuándo ocurrió y cuál fue su motivo.</p>
        </div>
      </div>

      <div className="panel filters-panel audit-filters-panel">
        <form className="audit-filters" onSubmit={applyFilters} noValidate>
          <div className="field">
            <label htmlFor="audit-entity-type">Entidad</label>
            <select id="audit-entity-type" value={draft.entityType} onChange={(event) => setDraft((current) => ({ ...current, entityType: event.target.value }))} disabled={loading}>
              <option value="">Todas</option>
              {AUDIT_ENTITY_TYPES.map((type) => <option key={type} value={type}>{AUDIT_ENTITY_LABELS[type]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="audit-entity-id">ID de entidad</label>
            <input id="audit-entity-id" inputMode="numeric" value={draft.entityId} onChange={(event) => setDraft((current) => ({ ...current, entityId: event.target.value }))} disabled={loading} />
          </div>
          <div className="field">
            <label htmlFor="audit-action">Acción</label>
            <select id="audit-action" value={draft.action} onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))} disabled={loading}>
              <option value="">Todas</option>
              {AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{AUDIT_ACTION_LABELS[action]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="audit-actor-id">ID del actor</label>
            <input id="audit-actor-id" inputMode="numeric" value={draft.actorUserId} onChange={(event) => setDraft((current) => ({ ...current, actorUserId: event.target.value }))} disabled={loading} />
          </div>
          <div className="field">
            <label htmlFor="audit-date-from">Desde</label>
            <input id="audit-date-from" type="date" value={draft.dateFrom} onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))} disabled={loading} />
          </div>
          <div className="field">
            <label htmlFor="audit-date-to">Hasta</label>
            <input id="audit-date-to" type="date" value={draft.dateTo} onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))} disabled={loading} />
          </div>
          <div className="filters__actions audit-filters__actions">
            <button className="button button--primary" type="submit" disabled={loading}>Aplicar filtros</button>
            <button className="button button--ghost" type="button" onClick={clearFilters} disabled={loading || (!hasFilters && !Object.values(draft).some(Boolean))}>Limpiar</button>
          </div>
        </form>
        {filterError ? <p className="inline-alert inline-alert--error" role="alert">{filterError}</p> : null}
      </div>

      <div className="panel audit-panel">
        {loading ? <LoadingState message="Consultando eventos de auditoría…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={loadEvents} /> : null}
        {!loading && !error && events.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No hay eventos para estos filtros' : 'Aún no hay eventos de auditoría'}
            message={hasFilters ? 'Ajusta los criterios e inténtalo nuevamente.' : 'Los cambios importantes del taller aparecerán aquí.'}
            action={hasFilters ? <button className="button button--secondary" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
          />
        ) : null}
        {!loading && !error && events.length > 0 ? (
          <>
            <div className="table-scroll" role="region" aria-label="Tabla de eventos de auditoría" tabIndex="0">
              <p className="table-scroll__hint">Desliza horizontalmente para ver todas las columnas.</p>
              <table className="data-table">
                <caption className="visually-hidden">Eventos de auditoría del taller</caption>
                <thead><tr><th scope="col">Fecha</th><th scope="col">Entidad</th><th scope="col">Acción</th><th scope="col">Actor</th><th scope="col">Motivo</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {events.map((auditEvent) => (
                    <tr key={auditEvent.id}>
                      <td data-label="Fecha">{formatDateTime(auditEvent.createdAt)}</td>
                      <td data-label="Entidad"><span className="cell-primary">{AUDIT_ENTITY_LABELS[auditEvent.entityType] ?? auditEvent.entityType}</span><span className="cell-secondary">ID {auditEvent.entityId}</span></td>
                      <td data-label="Acción"><span className="audit-action">{AUDIT_ACTION_LABELS[auditEvent.action] ?? auditEvent.action}</span></td>
                      <td data-label="Actor"><span className="cell-primary">{auditEvent.actor.name}</span><span className="cell-secondary">Usuario #{auditEvent.actor.id}</span></td>
                      <td data-label="Motivo"><span className="truncate-text">{auditEvent.reason ?? 'Sin motivo registrado'}</span></td>
                      <td className="table-action"><Link className="text-link" to={`/admin/audit/${auditEvent.id}`} aria-label={`Ver evento de auditoría ${auditEvent.id}`}>Ver detalle <span aria-hidden="true">→</span></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPageChange={setPage} disabled={loading} label="eventos" singularLabel="evento" ariaLabel="Paginación de auditoría" />
          </>
        ) : null}
      </div>
    </section>
  );
};
