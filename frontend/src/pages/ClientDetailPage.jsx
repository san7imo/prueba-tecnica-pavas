import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { clientsApi } from '../api/clientsApi.js';
import { DuplicateConflict } from '../components/ui/DuplicateConflict.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LifecycleBadge } from '../components/ui/LifecycleBadge.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getApiError } from '../utils/apiError.js';
import { formatDateTime } from '../utils/formatters.js';

const EMPTY_META = { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };

export const ClientDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [client, setClient] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice ?? '');
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clientResult, bikesResult] = await Promise.all([
        clientsApi.getById(id),
        bikesApi.list({ clientId: id, lifecycle: isAdmin ? 'all' : 'active', page, pageSize: 10 }),
      ]);
      setClient(clientResult);
      setBikes(bikesResult.data);
      setMeta(bikesResult.meta);
    } catch (requestError) {
      setError(getApiError(requestError, 'No fue posible cargar el cliente.').message);
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin, page]);

  useEffect(() => {
    // Synchronize client detail and its paginated relationships with the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const closeAction = () => {
    setAction(''); setReason(''); setDuplicateReason(''); setActionError(null); setCandidates([]);
  };

  const loadCandidates = async (candidateIds = []) => {
    const settled = await Promise.allSettled(candidateIds.map((candidateId) => clientsApi.getById(candidateId)));
    setCandidates(settled.filter(({ status }) => status === 'fulfilled').map(({ value }) => value));
  };

  const submitLifecycle = async (event, confirmDuplicate = false) => {
    event.preventDefault();
    if (saving || !reason.trim() || (actionError?.code === 'CLIENT_DUPLICATE_RISK' && !confirmDuplicate)) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = action === 'delete'
        ? await clientsApi.remove(id, reason.trim())
        : await clientsApi.restore(id, {
          reason: reason.trim(),
          ...(confirmDuplicate ? { confirmDuplicate: true, duplicateReason: duplicateReason.trim() } : {}),
        });
      setClient(updated);
      setNotice(`Cliente ${action === 'delete' ? 'eliminado' : 'restaurado'} correctamente.`);
      setPage(1);
      closeAction();
    } catch (requestError) {
      const apiError = getApiError(requestError, 'No fue posible cambiar el estado del cliente.');
      setActionError(apiError);
      if (apiError.code === 'CLIENT_DUPLICATE_RISK') await loadCandidates(apiError.details?.candidateIds);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !client) return <LoadingState message="Cargando cliente…" />;
  if (error && !client) return <ErrorState message={error} onRetry={load} />;
  if (!client) return null;

  const restoreConflict = actionError?.code === 'CLIENT_DUPLICATE_RISK';

  return (
    <section aria-labelledby="client-detail-title">
      <div className="page-heading page-heading--detail">
        <div>
          <Link className="back-link" to="/clients">← Volver a clientes</Link>
          <p className="eyebrow">Detalle del cliente</p>
          <div className="title-with-status"><h1 id="client-detail-title">{client.name}</h1><LifecycleBadge lifecycle={client.lifecycle} /></div>
          <p>C.C. {client.documentNumber || 'Pendiente'} · {client.phone}{client.email ? ` · ${client.email}` : ' · Sin correo registrado'}</p>
        </div>
        {isAdmin && client.lifecycle === 'active' ? <Link className="button button--secondary" to={`/clients/${id}/edit`}>Editar cliente</Link> : null}
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel related-panel" aria-labelledby="client-bikes-title">
            <div className="section-heading">
              <div><h2 id="client-bikes-title">Motocicletas relacionadas</h2><p>Incluye relaciones históricas; eliminar un registro no borra su vínculo.</p></div>
              {isAdmin && client.lifecycle === 'active' ? <Link className="button button--secondary" to={`/bikes/new?clientId=${client.id}`}>Agregar moto</Link> : null}
            </div>
            {loading ? <LoadingState message="Consultando motocicletas…" /> : null}
            {!loading && bikes.length === 0 ? <EmptyState title="Sin motocicletas relacionadas" message="Este cliente aún no tiene motocicletas registradas." /> : null}
            {!loading && bikes.length > 0 ? (
              <>
                <div className="table-scroll" tabIndex="0" role="region" aria-label="Motocicletas del cliente">
                  <table className="data-table"><thead><tr><th>Placa</th><th>Motocicleta</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                    <tbody>{bikes.map((bike) => <tr key={bike.id}><td data-label="Placa"><span className="plate">{bike.plate}</span></td><td data-label="Motocicleta"><span className="cell-primary">{bike.brand} {bike.model}</span><span className="cell-secondary">{bike.cylinder ? `${bike.cylinder} cc` : 'Sin cilindraje'}</span></td><td data-label="Estado"><LifecycleBadge lifecycle={bike.lifecycle} /></td><td className="table-action"><Link className="text-link" to={`/bikes/${bike.id}`}>Ver detalle</Link></td></tr>)}</tbody>
                  </table>
                </div>
                <Pagination meta={meta} onPageChange={setPage} disabled={loading} label="motocicletas" singularLabel="motocicleta" ariaLabel="Paginación de motocicletas del cliente" />
              </>
            ) : null}
          </section>
        </div>

        <aside className="detail-aside">
          <section className="panel resource-card">
            <p className="card-label">Contacto</p><h2>Datos registrados</h2>
            <dl><div><dt>Cédula</dt><dd>{client.documentNumber || 'Pendiente'}</dd></div><div><dt>Teléfono</dt><dd>{client.phone}</dd></div><div><dt>Correo</dt><dd>{client.email || 'No registrado'}</dd></div></dl>
          </section>
          {client.lifecycle === 'deleted' ? <section className="panel resource-card"><p className="card-label">Baja lógica</p><h2>Registro preservado</h2><dl><div><dt>Fecha</dt><dd>{formatDateTime(client.deletedAt)}</dd></div><div><dt>Motivo</dt><dd>{client.deleteReason}</dd></div></dl></section> : null}
          {isAdmin ? (
            <section className="panel lifecycle-panel">
              <p className="card-label">Administración</p><h2>{client.lifecycle === 'active' ? 'Eliminar cliente' : 'Restaurar cliente'}</h2>
              <p>{client.lifecycle === 'active' ? 'La baja es lógica y conservará todo su historial.' : 'El cliente volverá a estar disponible para operaciones.'}</p>
              {!action ? <button className={client.lifecycle === 'active' ? 'button button--danger-ghost' : 'button button--secondary'} type="button" onClick={() => setAction(client.lifecycle === 'active' ? 'delete' : 'restore')}>{client.lifecycle === 'active' ? 'Eliminar cliente' : 'Restaurar cliente'}</button> : (
                <form className="confirmation-panel" onSubmit={submitLifecycle}>
                  <div className="field"><label htmlFor="client-action-reason">Motivo<span className="required-mark"> *</span></label><textarea id="client-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength="500" disabled={saving} autoFocus /></div>
                  {actionError && !restoreConflict ? <p className="inline-alert inline-alert--error" role="alert">{actionError.message}</p> : null}
                  {restoreConflict ? <><DuplicateConflict conflict={actionError} candidates={candidates} /><div className="field"><label htmlFor="client-restore-duplicate-reason">Justificación del duplicado<span className="required-mark"> *</span></label><textarea id="client-restore-duplicate-reason" value={duplicateReason} onChange={(event) => setDuplicateReason(event.target.value)} required maxLength="500" disabled={saving} /></div></> : null}
                  <div className="form-actions"><button className="button button--ghost" type="button" onClick={closeAction} disabled={saving}>Cancelar</button>{restoreConflict ? <button className="button button--danger-ghost" type="button" onClick={(event) => submitLifecycle(event, true)} disabled={saving || !duplicateReason.trim()}>Confirmar restauración</button> : <button className={action === 'delete' ? 'button button--danger-ghost' : 'button button--primary'} type="submit" disabled={saving || !reason.trim()}>{saving ? 'Procesando…' : 'Confirmar'}</button>}</div>
                </form>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
};
