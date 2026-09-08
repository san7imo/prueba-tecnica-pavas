import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { clientsApi } from '../api/clientsApi.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LifecycleBadge } from '../components/ui/LifecycleBadge.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { Pagination } from '../features/workOrders/components/Pagination.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../utils/apiError.js';

const EMPTY_META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

export const ClientsPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [draftDocumentNumber, setDraftDocumentNumber] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftLifecycle, setDraftLifecycle] = useState('active');
  const [documentNumber, setDocumentNumber] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('active');
  const [page, setPage] = useState(1);
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await clientsApi.list({
        documentNumber,
        search,
        lifecycle,
        page,
        pageSize: 20,
      });
      setClients(result.data);
      setMeta(result.meta);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No fue posible consultar los clientes.'));
    } finally {
      setLoading(false);
    }
  }, [documentNumber, lifecycle, page, search]);

  useEffect(() => {
    // Synchronize the server-backed list whenever the applied filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setDocumentNumber(draftDocumentNumber.trim());
    setSearch(draftSearch.trim());
    setLifecycle(draftLifecycle);
  };

  const clearFilters = () => {
    setDraftDocumentNumber('');
    setDraftSearch('');
    setDraftLifecycle('active');
    setDocumentNumber('');
    setSearch('');
    setLifecycle('active');
    setPage(1);
  };

  const hasFilters = Boolean(
    documentNumber || search || lifecycle !== 'active',
  );

  return (
    <section aria-labelledby="clients-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Maestra comercial</p>
          <h1 id="clients-title">Clientes</h1>
          <p>Consulta contactos, estado y motocicletas relacionadas sin perder el historial.</p>
        </div>
        {isAdmin ? <Link className="button button--primary button--prominent" to="/clients/new">＋ Nuevo cliente</Link> : null}
      </div>

      <div className="panel filters-panel">
        <form className="filters" onSubmit={applyFilters}>
          <div className="field filters__plate">
            <label htmlFor="client-document-number">Cédula exacta</label>
            <input id="client-document-number" value={draftDocumentNumber} onChange={(event) => setDraftDocumentNumber(event.target.value)} placeholder="Ej. 1020304050" maxLength="50" inputMode="numeric" disabled={loading} autoFocus />
          </div>
          <div className="field filters__plate">
            <label htmlFor="client-search">Búsqueda secundaria</label>
            <input id="client-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Ej. Ana o 3001234567" maxLength="254" disabled={loading} />
          </div>
          {isAdmin ? (
            <div className="field field--compact">
              <label htmlFor="client-lifecycle">Estado del registro</label>
              <select id="client-lifecycle" value={draftLifecycle} onChange={(event) => setDraftLifecycle(event.target.value)} disabled={loading}>
                <option value="active">Activos</option>
                <option value="deleted">Eliminados</option>
                <option value="all">Todos</option>
              </select>
            </div>
          ) : null}
          <div className="filters__actions">
            <button className="button button--secondary" type="submit" disabled={loading}>Buscar</button>
            <button className="button button--ghost" type="button" onClick={clearFilters} disabled={loading || (!hasFilters && !draftDocumentNumber && !draftSearch && draftLifecycle === 'active')}>Limpiar</button>
          </div>
        </form>
      </div>

      <div className="panel orders-panel">
        {loading ? <LoadingState message="Consultando clientes…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && clients.length === 0 ? (
          <EmptyState title={hasFilters ? 'No hay clientes para estos filtros' : 'Aún no hay clientes'} message={hasFilters ? 'Ajusta la búsqueda o el estado del registro.' : 'Registra el primer cliente para asociar sus motocicletas.'} action={hasFilters ? <button className="button button--secondary" type="button" onClick={clearFilters}>Limpiar filtros</button> : (isAdmin ? <Link className="button button--primary" to="/clients/new">Crear primer cliente</Link> : null)} />
        ) : null}
        {!loading && !error && clients.length > 0 ? (
          <>
            <div className="table-scroll" tabIndex="0" role="region" aria-label="Listado de clientes">
              <table className="data-table">
                <thead><tr><th>Cédula</th><th>Cliente</th><th>Teléfono</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>{clients.map((client) => (
                  <tr key={client.id}>
                    <td data-label="Cédula"><span className="cell-primary">{client.documentNumber || 'Pendiente'}</span></td>
                    <td data-label="Cliente"><span className="cell-primary">{client.name}</span><span className="cell-secondary">{client.email || 'Sin correo registrado'}</span></td>
                    <td data-label="Teléfono">{client.phone}</td>
                    <td data-label="Estado"><LifecycleBadge lifecycle={client.lifecycle} /></td>
                    <td className="table-action"><Link className="text-link" to={`/clients/${client.id}`}>Ver detalle</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Pagination meta={meta} onPageChange={setPage} disabled={loading} label="clientes" singularLabel="cliente" ariaLabel="Paginación de clientes" />
          </>
        ) : null}
      </div>
    </section>
  );
};
