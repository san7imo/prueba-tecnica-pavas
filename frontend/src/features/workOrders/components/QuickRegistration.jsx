import { Link } from 'react-router-dom';

import { DuplicateConflict } from '../../../components/ui/DuplicateConflict.jsx';

export const QuickRegistration = ({
  mode,
  visible,
  clientForm,
  onClientChange,
  onClientSubmit,
  clientLoading,
  clientError,
  candidates,
  onSelectCandidate,
  duplicateReason,
  onDuplicateReasonChange,
  onConfirmDuplicate,
  selectedClient,
  bikeForm,
  onBikeChange,
  onBikeSubmit,
  bikeLoading,
  bikeError,
  onCancel,
}) => {
  if (!visible) return null;

  if (mode === 'client') {
    const duplicateConflict = ['CLIENT_DUPLICATE_RISK', 'CLIENT_RESTORE_REQUIRED']
      .includes(clientError?.code);
    const canOverride = clientError?.code === 'CLIENT_DUPLICATE_RISK';

    return (
      <div className="quick-registration" aria-labelledby="quick-client-title">
        <div className="section-heading">
          <div>
            <h3 id="quick-client-title">Registrar un cliente nuevo</h3>
            <p>Hazlo sólo si confirmaste que no corresponde a un registro existente.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={onClientSubmit} aria-label="Registro rápido de cliente">
          <div className="field field--span-2">
            <label htmlFor="quick-client-name">Nombre completo<span className="required-mark" aria-hidden="true"> *</span></label>
            <input id="quick-client-name" name="name" value={clientForm.name} onChange={onClientChange} required maxLength="120" disabled={clientLoading} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="quick-client-phone">Teléfono<span className="required-mark" aria-hidden="true"> *</span></label>
            <input id="quick-client-phone" name="phone" value={clientForm.phone} onChange={onClientChange} required minLength="7" maxLength="40" inputMode="tel" disabled={clientLoading} />
          </div>
          <div className="field">
            <label htmlFor="quick-client-email">Correo <span>(opcional)</span></label>
            <input id="quick-client-email" name="email" value={clientForm.email} onChange={onClientChange} type="email" maxLength="254" disabled={clientLoading} />
          </div>
          {clientError && !duplicateConflict ? <p className="inline-alert inline-alert--error field--span-2" role="alert">{clientError.message}</p> : null}
          {duplicateConflict ? <div className="field--span-2"><DuplicateConflict conflict={clientError} candidates={candidates} onSelect={onSelectCandidate} /></div> : null}
          {canOverride ? (
            <div className="field field--span-2">
              <label htmlFor="quick-duplicate-reason">Justificación para conservar ambos clientes<span className="required-mark" aria-hidden="true"> *</span></label>
              <textarea id="quick-duplicate-reason" value={duplicateReason} onChange={(event) => onDuplicateReasonChange(event.target.value)} required maxLength="500" disabled={clientLoading} />
              <small>Ejemplo: dos familiares comparten el mismo teléfono.</small>
            </div>
          ) : null}
          <div className="form-actions field--span-2">
            <button className="button button--ghost" type="button" onClick={onCancel} disabled={clientLoading}>Cancelar</button>
            <button className="button button--secondary" type="submit" disabled={clientLoading || duplicateConflict}>{clientLoading ? 'Guardando cliente…' : 'Guardar cliente'}</button>
            {canOverride ? <button className="button button--danger-ghost" type="button" onClick={onConfirmDuplicate} disabled={clientLoading || !duplicateReason.trim()}>{clientLoading ? 'Guardando…' : 'Confirmar cliente diferente'}</button> : null}
          </div>
        </form>
      </div>
    );
  }

  const plateConflict = ['BIKE_PLATE_ALREADY_EXISTS', 'BIKE_RESTORE_REQUIRED']
    .includes(bikeError?.code);
  const plateLookup = bikeForm.plate.trim();

  return (
    <div className="quick-registration" aria-labelledby="quick-bike-title">
      <div className="section-heading">
        <div>
          <h3 id="quick-bike-title">Registrar motocicleta para {selectedClient.name}</h3>
          <p>La nueva moto quedará vinculada al cliente seleccionado.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={onBikeSubmit} aria-label="Registro rápido de motocicleta">
        <div className="field">
          <label htmlFor="quick-bike-plate">Placa<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="quick-bike-plate" name="plate" value={bikeForm.plate} onChange={onBikeChange} required maxLength="20" disabled={bikeLoading} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="quick-bike-brand">Marca<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="quick-bike-brand" name="brand" value={bikeForm.brand} onChange={onBikeChange} required maxLength="100" disabled={bikeLoading} />
        </div>
        <div className="field">
          <label htmlFor="quick-bike-model">Modelo<span className="required-mark" aria-hidden="true"> *</span></label>
          <input id="quick-bike-model" name="model" value={bikeForm.model} onChange={onBikeChange} required maxLength="100" disabled={bikeLoading} />
        </div>
        <div className="field">
          <label htmlFor="quick-bike-cylinder">Cilindraje <span>(opcional)</span></label>
          <input id="quick-bike-cylinder" name="cylinder" value={bikeForm.cylinder} onChange={onBikeChange} maxLength="50" disabled={bikeLoading} />
        </div>
        {bikeError ? (
          <div className="inline-alert inline-alert--error field--span-2" role="alert">
            <p>{bikeError.message}</p>
            {plateConflict && plateLookup ? (
              <Link
                className="text-link"
                to={`/bikes?platePrefix=${encodeURIComponent(plateLookup)}&lifecycle=all`}
              >
                Buscar y revisar la motocicleta existente
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="form-actions field--span-2">
          <button className="button button--ghost" type="button" onClick={onCancel} disabled={bikeLoading}>Cancelar</button>
          <button className="button button--secondary" type="submit" disabled={bikeLoading}>{bikeLoading ? 'Guardando motocicleta…' : 'Guardar y seleccionar motocicleta'}</button>
        </div>
      </form>
    </div>
  );
};
