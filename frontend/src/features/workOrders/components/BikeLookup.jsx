export const BikeLookup = ({
  plate,
  onPlateChange,
  onSearch,
  loading,
  searched,
  bikes,
  selectedBike,
  onSelect,
  error,
}) => (
  <section className="workflow-card" aria-labelledby="bike-lookup-title">
    <div className="workflow-card__number" aria-hidden="true">1</div>
    <div className="workflow-card__content">
      <div className="section-heading">
        <div>
          <h2 id="bike-lookup-title">Busca la moto</h2>
          <p>Ingresa la placa para seleccionar un vehículo registrado.</p>
        </div>
        {selectedBike ? <span className="step-complete">Seleccionada</span> : null}
      </div>

      <form className="lookup-form" onSubmit={onSearch}>
        <div className="field">
          <label htmlFor="bike-plate-search">Placa de la moto</label>
          <input
            id="bike-plate-search"
            value={plate}
            onChange={(event) => onPlateChange(event.target.value)}
            placeholder="ABC123"
            maxLength={20}
            autoComplete="off"
            required
            disabled={loading}
            aria-describedby={error ? 'bike-search-error' : undefined}
          />
        </div>
        <button className="button button--secondary" type="submit" disabled={loading || !plate.trim()}>
          {loading ? 'Buscando…' : 'Buscar por placa'}
        </button>
      </form>

      {error ? <p id="bike-search-error" className="inline-alert inline-alert--error" role="alert">{error}</p> : null}

      {searched && !loading && bikes.length === 0 && !error ? (
        <p className="inline-alert" role="status">
          No encontramos una moto con esa placa. Registra el cliente y la moto en el siguiente paso.
        </p>
      ) : null}

      {bikes.length > 0 ? (
        <div className="selection-list" aria-label="Motos encontradas">
          {bikes.map((bike) => {
            const isSelected = selectedBike?.id === bike.id;
            return (
              <button
                key={bike.id}
                className={`selection-card${isSelected ? ' selection-card--selected' : ''}`}
                type="button"
                onClick={() => onSelect(bike)}
                aria-pressed={isSelected}
              >
                <span className="plate">{bike.plate}</span>
                <span>
                  <strong>{bike.brand} {bike.model}</strong>
                  <small>Cliente: {bike.client.name}</small>
                </span>
                <span className="selection-card__action">{isSelected ? 'Seleccionada' : 'Seleccionar'}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  </section>
);
