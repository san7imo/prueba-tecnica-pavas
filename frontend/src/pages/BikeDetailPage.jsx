import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { workOrdersApi } from '../api/workOrdersApi.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LifecycleBadge } from '../components/ui/LifecycleBadge.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../utils/apiError.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const EMPTY_META = { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };

export const BikeDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [bike, setBike] = useState(null);
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice ?? '');
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [bikeResult, ordersResult] = await Promise.all([
        bikesApi.getById(id),
        workOrdersApi.list({ bikeId: id, page, pageSize: 10 }),
      ]);
      setBike(bikeResult); setOrders(ordersResult.data); setMeta(ordersResult.meta);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No fue posible cargar la motocicleta.'));
    } finally { setLoading(false); }
  }, [id, page]);

  useEffect(() => {
    // Synchronize bike detail and its paginated history with the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const closeAction = () => { setAction(''); setReason(''); setActionError(''); };
  const submitLifecycle = async (event) => {
    event.preventDefault();
    if (saving || !reason.trim()) return;
    setSaving(true); setActionError('');
    try {
      const updated = action === 'delete' ? await bikesApi.remove(id, reason.trim()) : await bikesApi.restore(id, reason.trim());
      setBike((current) => ({ ...updated, currentOpenOrder: current?.currentOpenOrder ?? null }));
      setNotice(`Motocicleta ${action === 'delete' ? 'eliminada' : 'restaurada'} correctamente.`);
      closeAction();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, 'No fue posible cambiar el estado de la motocicleta.'));
    } finally { setSaving(false); }
  };

  if (loading && !bike) return <LoadingState message="Cargando motocicleta…" />;
  if (error && !bike) return <ErrorState message={error} onRetry={load} />;
  if (!bike) return null;

  return (
    <section aria-labelledby="bike-detail-title">
      <div className="page-heading page-heading--detail"><div><Link className="back-link" to="/bikes">← Volver a motocicletas</Link><p className="eyebrow">Detalle de motocicleta</p><div className="title-with-status"><h1 id="bike-detail-title"><span className="plate plate--heading">{bike.plate}</span></h1><LifecycleBadge lifecycle={bike.lifecycle} /></div><p>{bike.brand} {bike.model}{bike.cylinder ? ` · ${bike.cylinder} cc` : ''}</p></div>{isAdmin && bike.lifecycle === 'active' ? <Link className="button button--secondary" to={`/bikes/${id}/edit`}>Editar motocicleta</Link> : null}</div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}
      <div className="detail-grid">
        <div className="detail-main">
          {bike.currentOpenOrder ? <section className="panel current-order-card"><div className="section-heading"><div><p className="card-label">Orden abierta actual</p><h2>Orden #{bike.currentOpenOrder.id}</h2></div><StatusBadge status={bike.currentOpenOrder.status} /></div><p className="fault-description">{bike.currentOpenOrder.faultDescription}</p><div className="order-summary"><span>Ingreso: {formatDateTime(bike.currentOpenOrder.entryDate)}</span><strong>{formatCurrency(bike.currentOpenOrder.total)}</strong></div><Link className="button button--secondary" to={`/orders/${bike.currentOpenOrder.id}`}>Ver orden abierta</Link></section> : <section className="panel no-open-order"><p className="card-label">Situación operativa</p><h2>Sin orden abierta</h2><p>La motocicleta no tiene trabajos activos en este momento.</p></section>}
          <section className="panel related-panel" aria-labelledby="bike-orders-title"><div className="section-heading"><div><h2 id="bike-orders-title">Historial de órdenes</h2><p>Todas las visitas registradas para esta motocicleta, paginadas de la más reciente.</p></div></div>{loading ? <LoadingState message="Consultando órdenes…" /> : null}{!loading && orders.length === 0 ? <EmptyState title="Sin órdenes registradas" message="Esta motocicleta aún no tiene historial de servicio." /> : null}{!loading && orders.length > 0 ? <><div className="table-scroll" tabIndex="0" role="region" aria-label="Historial de órdenes de la motocicleta"><table className="data-table"><thead><tr><th>Orden</th><th>Ingreso</th><th>Estado</th><th>Total</th><th><span className="visually-hidden">Acciones</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td data-label="Orden"><span className="cell-primary">#{order.id}</span><span className="cell-secondary truncate-text">{order.faultDescription}</span></td><td data-label="Ingreso">{formatDateTime(order.entryDate)}</td><td data-label="Estado"><StatusBadge status={order.status} /></td><td data-label="Total" className="money">{formatCurrency(order.total)}</td><td className="table-action"><Link className="text-link" to={`/orders/${order.id}`}>Ver orden</Link></td></tr>)}</tbody></table></div><Pagination meta={meta} onPageChange={setPage} disabled={loading} label="órdenes" singularLabel="orden" ariaLabel="Paginación del historial de órdenes" /></> : null}</section>
        </div>
        <aside className="detail-aside">
          <section className="panel resource-card"><p className="card-label">Propietario actual</p><h2><Link className="text-link text-link--heading" to={`/clients/${bike.client.id}`}>{bike.client.name}</Link></h2><dl><div><dt>Teléfono</dt><dd>{bike.client.phone}</dd></div><div><dt>Correo</dt><dd>{bike.client.email || 'No registrado'}</dd></div><div><dt>Estado</dt><dd><LifecycleBadge lifecycle={bike.client.lifecycle} /></dd></div></dl></section>
          {bike.lifecycle === 'deleted' ? <section className="panel resource-card"><p className="card-label">Baja lógica</p><h2>Registro preservado</h2><dl><div><dt>Fecha</dt><dd>{formatDateTime(bike.deletedAt)}</dd></div><div><dt>Motivo</dt><dd>{bike.deleteReason}</dd></div></dl></section> : null}
          {isAdmin ? <section className="panel lifecycle-panel"><p className="card-label">Administración</p><h2>{bike.lifecycle === 'active' ? 'Eliminar motocicleta' : 'Restaurar motocicleta'}</h2><p>{bike.lifecycle === 'active' ? 'No podrá eliminarse si tiene una orden abierta.' : 'Solo se restaurará si su propietario sigue activo.'}</p>{!action ? <button className={bike.lifecycle === 'active' ? 'button button--danger-ghost' : 'button button--secondary'} type="button" onClick={() => setAction(bike.lifecycle === 'active' ? 'delete' : 'restore')}>{bike.lifecycle === 'active' ? 'Eliminar motocicleta' : 'Restaurar motocicleta'}</button> : <form className="confirmation-panel" onSubmit={submitLifecycle}><div className="field"><label htmlFor="bike-action-reason">Motivo<span className="required-mark"> *</span></label><textarea id="bike-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength="500" disabled={saving} autoFocus /></div>{actionError ? <p className="inline-alert inline-alert--error" role="alert">{actionError}</p> : null}<div className="form-actions"><button className="button button--ghost" type="button" onClick={closeAction} disabled={saving}>Cancelar</button><button className={action === 'delete' ? 'button button--danger-ghost' : 'button button--primary'} type="submit" disabled={saving || !reason.trim()}>{saving ? 'Procesando…' : 'Confirmar'}</button></div></form>}</section> : null}
        </aside>
      </div>
    </section>
  );
};
