import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { clientsApi } from '../api/clientsApi.js';
import { ClientSelector } from '../components/clients/ClientSelector.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { getApiErrorMessage } from '../utils/apiError.js';

const EMPTY_FORM = { plate: '', brand: '', model: '', cylinder: '' };

export const BikeFormPage = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [originalOwner, setOriginalOwner] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerReason, setOwnerReason] = useState('');
  const [loading, setLoading] = useState(editing || Boolean(searchParams.get('clientId')));
  const [loadVersion, setLoadVersion] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [error, setError] = useState('');
  const [ownerError, setOwnerError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (editing) {
          const bike = await bikesApi.getById(id);
          if (!active) return;
          if (bike.lifecycle === 'deleted') {
            setLoadError('Restaura la motocicleta antes de editarla o cambiar su propietario.');
            return;
          }
          setForm({ plate: bike.plate, brand: bike.brand, model: bike.model, cylinder: bike.cylinder ?? '' });
          setOriginalOwner(bike.client);
          setSelectedOwner(bike.client);
        } else {
          const clientId = searchParams.get('clientId');
          if (clientId) {
            const client = await clientsApi.getById(clientId);
            if (active && client.lifecycle === 'active') setSelectedOwner(client);
            if (active && client.lifecycle !== 'active') setError('El cliente preseleccionado está eliminado. Busca un propietario activo.');
          }
        }
      } catch (requestError) {
        if (active) setLoadError(getApiErrorMessage(requestError, 'No fue posible preparar el formulario de la motocicleta.'));
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [editing, id, loadVersion, searchParams]);

  const retryLoad = () => {
    setLoadError('');
    setLoading(true);
    setLoadVersion((current) => current + 1);
  };

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving || (!editing && !selectedOwner)) return;
    setSaving(true); setError('');
    const payload = { plate: form.plate.trim(), brand: form.brand.trim(), model: form.model.trim(), cylinder: form.cylinder.trim() || null, ...(!editing ? { clientId: selectedOwner.id } : {}) };
    try {
      const bike = editing ? await bikesApi.update(id, payload) : await bikesApi.create(payload);
      navigate(`/bikes/${bike.id}`, { state: { notice: `Motocicleta ${editing ? 'actualizada' : 'creada'} correctamente.` } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `No fue posible ${editing ? 'actualizar' : 'crear'} la motocicleta.`));
    } finally { setSaving(false); }
  };

  const changeOwner = async (event) => {
    event.preventDefault();
    if (ownerSaving || !selectedOwner || selectedOwner.id === originalOwner.id || !ownerReason.trim()) return;
    setOwnerSaving(true); setOwnerError('');
    try {
      const bike = await bikesApi.changeOwner(id, { clientId: selectedOwner.id, reason: ownerReason.trim() });
      navigate(`/bikes/${bike.id}`, { state: { notice: 'Propietario actualizado correctamente.' } });
    } catch (requestError) {
      setOwnerError(getApiErrorMessage(requestError, 'No fue posible cambiar el propietario.'));
    } finally { setOwnerSaving(false); }
  };

  if (loading) return <LoadingState message="Cargando formulario…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={retryLoad} />;

  return (
    <section aria-labelledby="bike-form-title">
      <div className="page-heading page-heading--with-back"><div><Link className="back-link" to={editing ? `/bikes/${id}` : '/bikes'}>← Volver a motocicletas</Link><p className="eyebrow">Maestra de motocicletas</p><h1 id="bike-form-title">{editing ? 'Editar motocicleta' : 'Nueva motocicleta'}</h1><p>La placa se normaliza automáticamente y permanece única incluso si el registro se elimina.</p></div></div>
      <div className={editing ? 'master-form-layout' : 'master-form-layout master-form-layout--single'}>
        <section className="panel form-panel">
          <div className="section-heading section-heading--compact"><div><h2>Datos de la motocicleta</h2><p>Información general visible en órdenes e historial.</p></div></div>
          <form className="form-grid" onSubmit={submit} aria-label={editing ? 'Editar motocicleta' : 'Crear motocicleta'}>
            <div className="field"><label htmlFor="bike-plate">Placa<span className="required-mark"> *</span></label><input id="bike-plate" value={form.plate} onChange={(event) => change('plate', event.target.value)} required maxLength="20" disabled={saving} autoFocus /></div>
            <div className="field"><label htmlFor="bike-brand">Marca<span className="required-mark"> *</span></label><input id="bike-brand" value={form.brand} onChange={(event) => change('brand', event.target.value)} required maxLength="100" disabled={saving} /></div>
            <div className="field"><label htmlFor="bike-model">Modelo<span className="required-mark"> *</span></label><input id="bike-model" value={form.model} onChange={(event) => change('model', event.target.value)} required maxLength="100" disabled={saving} /></div>
            <div className="field"><label htmlFor="bike-cylinder">Cilindraje <span>(opcional)</span></label><input id="bike-cylinder" value={form.cylinder} onChange={(event) => change('cylinder', event.target.value)} maxLength="50" disabled={saving} /></div>
            {!editing ? <div className="field field--span-2"><label>Propietario<span className="required-mark"> *</span></label><ClientSelector selected={selectedOwner} onSelect={setSelectedOwner} disabled={saving} /><small>¿No existe? <Link className="text-link" to="/clients/new">Registra primero el cliente.</Link></small></div> : null}
            {error ? <p className="inline-alert inline-alert--error field--span-2" role="alert">{error}</p> : null}
            <div className="form-actions form-actions--end field--span-2"><Link className="button button--ghost" to={editing ? `/bikes/${id}` : '/bikes'}>Cancelar</Link><button className="button button--primary" type="submit" disabled={saving || (!editing && !selectedOwner)}>{saving ? 'Guardando…' : `Guardar ${editing ? 'cambios' : 'motocicleta'}`}</button></div>
          </form>
        </section>

        {editing ? <section className="panel form-panel"><div className="section-heading section-heading--compact"><div><h2>Cambiar propietario</h2><p>Operación independiente, justificada y auditada.</p></div></div><form onSubmit={changeOwner}><div className="field"><label>Nuevo propietario</label><ClientSelector selected={selectedOwner} onSelect={setSelectedOwner} disabled={ownerSaving} /></div>{selectedOwner?.id !== originalOwner?.id ? <div className="field owner-reason"><label htmlFor="owner-reason">Motivo del cambio<span className="required-mark"> *</span></label><textarea id="owner-reason" value={ownerReason} onChange={(event) => setOwnerReason(event.target.value)} required maxLength="500" disabled={ownerSaving} /></div> : null}{ownerError ? <p className="inline-alert inline-alert--error" role="alert">{ownerError}</p> : null}<div className="form-actions form-actions--end"><button className="button button--primary" type="submit" disabled={ownerSaving || !selectedOwner || selectedOwner.id === originalOwner.id || !ownerReason.trim()}>{ownerSaving ? 'Actualizando…' : 'Cambiar propietario'}</button></div></form></section> : null}
      </div>
    </section>
  );
};
