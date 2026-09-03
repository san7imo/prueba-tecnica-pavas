import { useState } from 'react';

import { clientsApi } from '../../api/clientsApi.js';
import { getApiErrorMessage } from '../../utils/apiError.js';

export const ClientSelector = ({ selected, onSelect, disabled = false }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await clientsApi.list({ search: search.trim(), lifecycle: 'active', pageSize: 10 });
      setResults(response.data);
      setSearched(true);
    } catch (requestError) {
      setResults([]);
      setSearched(true);
      setError(getApiErrorMessage(requestError, 'No fue posible buscar clientes.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-selector">
      {selected ? <div className="selected-client" role="status"><span><strong>{selected.name}</strong><small>{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</small></span><button className="text-button" type="button" onClick={() => onSelect(null)} disabled={disabled}>Cambiar</button></div> : null}
      {!selected ? (
        <>
          <form className="lookup-form" onSubmit={submit}>
            <div className="field"><label htmlFor="owner-search">Buscar cliente activo</label><input id="owner-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, teléfono o correo" maxLength="254" disabled={disabled || loading} /></div>
            <button className="button button--secondary" type="submit" disabled={disabled || loading}>{loading ? 'Buscando…' : 'Buscar'}</button>
          </form>
          {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}
          {searched && !loading && !error && results.length === 0 ? <p className="inline-alert" role="status">No se encontraron clientes activos. Ajusta la búsqueda o registra uno nuevo.</p> : null}
          {results.length ? <div className="selection-list" aria-label="Clientes encontrados">{results.map((client) => <button key={client.id} className="selection-card selection-card--client" type="button" onClick={() => onSelect(client)} disabled={disabled}><span><strong>{client.name}</strong><small>{client.phone}{client.email ? ` · ${client.email}` : ''}</small></span><span className="selection-card__action">Seleccionar</span></button>)}</div> : null}
        </>
      ) : null}
    </div>
  );
};
