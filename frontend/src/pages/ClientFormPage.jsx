import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { clientsApi } from '../api/clientsApi.js';
import { DuplicateConflict } from '../components/ui/DuplicateConflict.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { getApiError } from '../utils/apiError.js';

const EMPTY_FORM = { name: '', phone: '', email: '' };
const DUPLICATE_CODES = new Set(['CLIENT_DUPLICATE_RISK', 'CLIENT_RESTORE_REQUIRED']);

export const ClientFormPage = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [duplicateReason, setDuplicateReason] = useState('');

  useEffect(() => {
    if (!editing) return;
    let active = true;
    clientsApi.getById(id)
      .then((client) => {
        if (active) setForm({ name: client.name, phone: client.phone, email: client.email ?? '' });
      })
      .catch((requestError) => {
        if (active) setLoadError(getApiError(requestError, 'No fue posible cargar el cliente.').message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, id]);

  const loadCandidates = async (candidateIds = []) => {
    const settled = await Promise.allSettled(candidateIds.map((candidateId) => clientsApi.getById(candidateId)));
    setCandidates(settled.filter(({ status }) => status === 'fulfilled').map(({ value }) => value));
  };

  const submit = async (event, confirmDuplicate = false) => {
    event?.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      ...(confirmDuplicate ? { confirmDuplicate: true, duplicateReason: duplicateReason.trim() } : {}),
    };
    try {
      const client = editing ? await clientsApi.update(id, payload) : await clientsApi.create(payload);
      navigate(`/clients/${client.id}`, { state: { notice: `Cliente ${editing ? 'actualizado' : 'creado'} correctamente.` } });
    } catch (requestError) {
      const apiError = getApiError(requestError, `No fue posible ${editing ? 'actualizar' : 'crear'} el cliente.`);
      setError(apiError);
      setDuplicateReason('');
      if (DUPLICATE_CODES.has(apiError.code)) await loadCandidates(apiError.details?.candidateIds);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Cargando cliente…" />;
  if (loadError) return <ErrorState message={loadError} />;

  const canOverride = error?.code === 'CLIENT_DUPLICATE_RISK';
  const hasDuplicateConflict = DUPLICATE_CODES.has(error?.code);

  return (
    <section aria-labelledby="client-form-title">
      <div className="page-heading page-heading--with-back">
        <div>
          <Link className="back-link" to={editing ? `/clients/${id}` : '/clients'}>← Volver a clientes</Link>
          <p className="eyebrow">Maestra de clientes</p>
          <h1 id="client-form-title">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h1>
          <p>Los datos de contacto se normalizan y se revisan para prevenir registros duplicados.</p>
        </div>
      </div>
      <div className="panel form-panel">
        <form className="form-grid" onSubmit={submit} aria-label={editing ? 'Editar cliente' : 'Crear cliente'}>
          <div className="field field--span-2"><label htmlFor="client-name">Nombre completo<span className="required-mark"> *</span></label><input id="client-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength="120" disabled={saving} autoFocus /></div>
          <div className="field"><label htmlFor="client-phone">Teléfono<span className="required-mark"> *</span></label><input id="client-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required minLength="7" maxLength="40" inputMode="tel" disabled={saving} /></div>
          <div className="field"><label htmlFor="client-email">Correo <span>(opcional)</span></label><input id="client-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" maxLength="254" disabled={saving} /></div>
          {error && !DUPLICATE_CODES.has(error.code) ? <p className="inline-alert inline-alert--error field--span-2" role="alert">{error.message}</p> : null}
          {DUPLICATE_CODES.has(error?.code) ? <div className="field--span-2"><DuplicateConflict conflict={error} candidates={candidates} /></div> : null}
          {canOverride ? (
            <div className="field field--span-2">
              <label htmlFor="duplicate-reason">Justificación para conservar ambos registros<span className="required-mark"> *</span></label>
              <textarea id="duplicate-reason" value={duplicateReason} onChange={(event) => setDuplicateReason(event.target.value)} required maxLength="500" disabled={saving} />
              <small>Ejemplo: dos integrantes de una familia comparten el mismo teléfono.</small>
            </div>
          ) : null}
          <div className="form-actions form-actions--end field--span-2">
            <Link className="button button--ghost" to={editing ? `/clients/${id}` : '/clients'}>Cancelar</Link>
            <button className="button button--primary" type="submit" disabled={saving || hasDuplicateConflict}>{saving ? 'Guardando…' : `Guardar ${editing ? 'cambios' : 'cliente'}`}</button>
            {canOverride ? <button className="button button--danger-ghost" type="button" onClick={(event) => submit(event, true)} disabled={saving || !duplicateReason.trim()}>Confirmar duplicado</button> : null}
          </div>
        </form>
      </div>
    </section>
  );
};
