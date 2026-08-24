export const QuickRegistration = ({
  visible,
  clientForm,
  onClientChange,
  onClientSubmit,
  createdClient,
  bikeForm,
  onBikeChange,
  onBikeSubmit,
  clientLoading,
  bikeLoading,
  error,
}) => {
  if (!visible) return null;

  return (
    <section className="workflow-card" aria-labelledby="quick-registration-title">
      <div className="workflow-card__number" aria-hidden="true">2</div>
      <div className="workflow-card__content">
        <div className="section-heading">
          <div>
            <h2 id="quick-registration-title">Registro rápido</h2>
            <p>Crea primero el cliente y luego asocia su moto.</p>
          </div>
          {createdClient ? <span className="step-complete">Cliente creado</span> : null}
        </div>

        {error ? <p id="quick-registration-error" className="inline-alert inline-alert--error" role="alert">{error}</p> : null}

        {!createdClient ? (
          <form className="form-grid" onSubmit={onClientSubmit} aria-label="Registro rápido de cliente">
            <div className="field field--span-2">
              <label htmlFor="client-name">Nombre completo</label>
              <input id="client-name" name="name" value={clientForm.name} onChange={onClientChange} required maxLength={120} disabled={clientLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
            </div>
            <div className="field">
              <label htmlFor="client-phone">Teléfono</label>
              <input id="client-phone" name="phone" value={clientForm.phone} onChange={onClientChange} required maxLength={40} inputMode="tel" disabled={clientLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
            </div>
            <div className="field">
              <label htmlFor="client-email">Correo <span>(opcional)</span></label>
              <input id="client-email" name="email" value={clientForm.email} onChange={onClientChange} type="email" maxLength={254} disabled={clientLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
            </div>
            <div className="form-actions field--span-2">
              <button className="button button--secondary" type="submit" disabled={clientLoading}>
                {clientLoading ? 'Guardando cliente…' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="created-resource" role="status">
              <span aria-hidden="true">✓</span>
              <div><strong>{createdClient.name}</strong><small>{createdClient.phone}</small></div>
            </div>
            <form className="form-grid" onSubmit={onBikeSubmit} aria-label="Registro rápido de moto">
              <div className="field">
                <label htmlFor="bike-plate">Placa</label>
                <input id="bike-plate" name="plate" value={bikeForm.plate} onChange={onBikeChange} required maxLength={20} disabled={bikeLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
              </div>
              <div className="field">
                <label htmlFor="bike-brand">Marca</label>
                <input id="bike-brand" name="brand" value={bikeForm.brand} onChange={onBikeChange} required maxLength={100} disabled={bikeLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
              </div>
              <div className="field">
                <label htmlFor="bike-model">Modelo</label>
                <input id="bike-model" name="model" value={bikeForm.model} onChange={onBikeChange} required maxLength={100} disabled={bikeLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
              </div>
              <div className="field">
                <label htmlFor="bike-cylinder">Cilindraje <span>(opcional)</span></label>
                <input id="bike-cylinder" name="cylinder" value={bikeForm.cylinder} onChange={onBikeChange} maxLength={50} disabled={bikeLoading} aria-describedby={error ? 'quick-registration-error' : undefined} />
              </div>
              <div className="form-actions field--span-2">
                <button className="button button--secondary" type="submit" disabled={bikeLoading}>
                  {bikeLoading ? 'Guardando moto…' : 'Guardar y seleccionar moto'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
};
