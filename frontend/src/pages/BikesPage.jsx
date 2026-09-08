import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LifecycleBadge } from '../components/ui/LifecycleBadge.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../utils/apiError.js';

const EMPTY_META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
const LIFECYCLES = new Set(['active', 'deleted', 'all']);

const positivePage = (value) => {
  if (!/^[1-9]\d*$/.test(value ?? '')) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
};

export const BikesPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLifecycle = searchParams.get('lifecycle');
  const initialLifecycle = isAdmin && LIFECYCLES.has(requestedLifecycle)
    ? requestedLifecycle
    : 'active';
  const initialPlatePrefix = searchParams.get('platePrefix') ?? '';
  const initialClientDocumentNumber = searchParams.get('clientDocumentNumber') ?? '';
  const [draftPlate, setDraftPlate] = useState(initialPlatePrefix);
  const [draftClientDocumentNumber, setDraftClientDocumentNumber] = useState(
    initialClientDocumentNumber,
  );
  const [draftLifecycle, setDraftLifecycle] = useState(initialLifecycle);
  const [platePrefix, setPlatePrefix] = useState(initialPlatePrefix);
  const [clientDocumentNumber, setClientDocumentNumber] = useState(
    initialClientDocumentNumber,
  );
  const [lifecycle, setLifecycle] = useState(initialLifecycle);
  const [page, setPage] = useState(positivePage(searchParams.get('page')));
  const [bikes, setBikes] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await bikesApi.list({
        platePrefix,
        clientDocumentNumber,
        lifecycle,
        page,
        pageSize: 20,
      });
      setBikes(result.data); setMeta(result.meta);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No fue posible consultar las motocicletas.'));
    } finally { setLoading(false); }
  }, [clientDocumentNumber, lifecycle, page, platePrefix]);

  useEffect(() => {
    // Synchronize the server-backed list whenever the applied filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const updateLocation = ({
    nextPlatePrefix = platePrefix,
    nextClientDocumentNumber = clientDocumentNumber,
    nextLifecycle = lifecycle,
    nextPage = page,
  } = {}) => {
    const next = new URLSearchParams();
    if (nextPlatePrefix) next.set('platePrefix', nextPlatePrefix);
    if (nextClientDocumentNumber) {
      next.set('clientDocumentNumber', nextClientDocumentNumber);
    }
    if (isAdmin && nextLifecycle !== 'active') next.set('lifecycle', nextLifecycle);
    if (nextPage > 1) next.set('page', String(nextPage));
    setSearchParams(next, { replace: true });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    const nextPlatePrefix = draftPlate.trim();
    const nextClientDocumentNumber = draftClientDocumentNumber.trim();
    setPage(1);
    setPlatePrefix(nextPlatePrefix);
    setClientDocumentNumber(nextClientDocumentNumber);
    setLifecycle(draftLifecycle);
    updateLocation({
      nextPlatePrefix,
      nextClientDocumentNumber,
      nextLifecycle: draftLifecycle,
      nextPage: 1,
    });
  };

  const clearFilters = () => {
    setDraftPlate('');
    setDraftClientDocumentNumber('');
    setDraftLifecycle('active');
    setPlatePrefix('');
    setClientDocumentNumber('');
    setLifecycle('active');
    setPage(1);
    updateLocation({
      nextPlatePrefix: '',
      nextClientDocumentNumber: '',
      nextLifecycle: 'active',
      nextPage: 1,
    });
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    updateLocation({ nextPage });
  };
  const hasFilters = Boolean(
    platePrefix || clientDocumentNumber || lifecycle !== 'active',
  );

  return (
    <section aria-labelledby="bikes-title">
      <div className="page-heading"><div><p className="eyebrow">Maestra del taller</p><h1 id="bikes-title">Motocicletas</h1><p>Busca por cédula del propietario o inicio de placa y consulta el historial.</p></div>{isAdmin ? <Link className="button button--primary button--prominent" to="/bikes/new">＋ Nueva motocicleta</Link> : null}</div>
      <div className="panel filters-panel"><form className="filters" onSubmit={applyFilters}><div className="field filters__plate"><label htmlFor="bike-client-document">Cédula del propietario</label><input id="bike-client-document" value={draftClientDocumentNumber} onChange={(event) => setDraftClientDocumentNumber(event.target.value)} placeholder="Ej. 1020304050" maxLength="50" inputMode="numeric" disabled={loading} autoFocus /></div><div className="field filters__plate"><label htmlFor="bike-prefix">Inicio de placa</label><input id="bike-prefix" value={draftPlate} onChange={(event) => setDraftPlate(event.target.value)} placeholder="Ej. ABC" maxLength="20" disabled={loading} /></div>{isAdmin ? <div className="field field--compact"><label htmlFor="bike-lifecycle">Estado del registro</label><select id="bike-lifecycle" value={draftLifecycle} onChange={(event) => setDraftLifecycle(event.target.value)} disabled={loading}><option value="active">Activas</option><option value="deleted">Eliminadas</option><option value="all">Todas</option></select></div> : null}<div className="filters__actions"><button className="button button--secondary" type="submit" disabled={loading}>Buscar</button><button className="button button--ghost" type="button" onClick={clearFilters} disabled={loading || (!hasFilters && !draftPlate && !draftClientDocumentNumber && draftLifecycle === 'active')}>Limpiar</button></div></form></div>
      <div className="panel orders-panel">
        {loading ? <LoadingState message="Consultando motocicletas…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && bikes.length === 0 ? <EmptyState title={hasFilters ? 'No hay motocicletas para estos filtros' : 'Aún no hay motocicletas'} message={hasFilters ? 'Ajusta la cédula, la placa o el estado del registro.' : 'Registra la primera motocicleta y relaciónala con su propietario.'} action={hasFilters ? <button className="button button--secondary" type="button" onClick={clearFilters}>Limpiar filtros</button> : (isAdmin ? <Link className="button button--primary" to="/bikes/new">Crear primera motocicleta</Link> : null)} /> : null}
        {!loading && !error && bikes.length > 0 ? <><div className="table-scroll" tabIndex="0" role="region" aria-label="Listado de motocicletas"><table className="data-table"><thead><tr><th>Placa</th><th>Motocicleta</th><th>Propietario</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead><tbody>{bikes.map((bike) => <tr key={bike.id}><td data-label="Placa"><span className="plate">{bike.plate}</span></td><td data-label="Motocicleta"><span className="cell-primary">{bike.brand} {bike.model}</span><span className="cell-secondary">{bike.cylinder ? `${bike.cylinder} cc` : 'Sin cilindraje'}</span></td><td data-label="Propietario"><Link className="text-link" to={`/clients/${bike.client.id}`}>{bike.client.name}</Link><span className="cell-secondary">C.C. {bike.client.documentNumber || 'pendiente'}</span></td><td data-label="Estado"><LifecycleBadge lifecycle={bike.lifecycle} /></td><td className="table-action"><Link className="text-link" to={`/bikes/${bike.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div><Pagination meta={meta} onPageChange={changePage} disabled={loading} label="motocicletas" singularLabel="motocicleta" ariaLabel="Paginación de motocicletas" /></> : null}
      </div>
    </section>
  );
};
