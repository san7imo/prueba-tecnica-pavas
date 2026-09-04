import { Link } from 'react-router-dom';

import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';

export const BikeLookup = ({
  client,
  loading,
  bikes,
  selectedBike,
  onSelect,
  onCreate,
  onRetry,
  error,
  checking,
  activeOrder,
  disabled = false,
}) => (
  <section className={`workflow-card${client ? '' : ' workflow-card--disabled'}`} aria-labelledby="bike-lookup-title">
    <div className="workflow-card__number" aria-hidden="true">2</div>
    <div className="workflow-card__content">
      <div className="section-heading">
        <div>
          <h2 id="bike-lookup-title">Selecciona la motocicleta</h2>
          <p>{client ? `Motocicletas activas registradas para ${client.name}.` : 'Selecciona primero un cliente activo.'}</p>
        </div>
        {selectedBike ? <span className="step-complete">Seleccionada</span> : null}
      </div>

      {loading ? <p className="inline-alert" role="status">Consultando motocicletas…</p> : null}
      {error ? <div className="inline-alert inline-alert--error" role="alert"><p>{error}</p><button className="text-button" type="button" onClick={onRetry} disabled={disabled}>Reintentar</button></div> : null}

      {client && !loading && bikes.length === 0 && !error ? (
        <div className="empty-lookup">
          <p className="inline-alert" role="status">Este cliente no tiene motocicletas activas. Registra una para continuar.</p>
          <button className="button button--secondary" type="button" onClick={onCreate} disabled={disabled}>Registrar motocicleta</button>
        </div>
      ) : null}

      {client && bikes.length > 0 ? (
        <>
          <div className="selection-list" aria-label="Motocicletas del cliente">
            {bikes.map((bike) => {
              const isSelected = selectedBike?.id === bike.id;
              return (
                <button
                  key={bike.id}
                  className={`selection-card${isSelected ? ' selection-card--selected' : ''}`}
                  type="button"
                  onClick={() => onSelect(bike)}
                  aria-pressed={isSelected}
                  disabled={checking || disabled}
                >
                  <span className="plate">{bike.plate}</span>
                  <span>
                    <strong>{bike.brand} {bike.model}</strong>
                    <small>{bike.cylinder ? `${bike.cylinder} cc` : 'Sin cilindraje registrado'}</small>
                  </span>
                  <span className="selection-card__action">{checking && isSelected ? 'Comprobando…' : isSelected ? 'Seleccionada' : 'Seleccionar'}</span>
                </button>
              );
            })}
          </div>
          <button className="text-button workflow-secondary-action" type="button" onClick={onCreate} disabled={checking || disabled}>Registrar otra motocicleta</button>
        </>
      ) : null}

      {activeOrder ? <div className="inline-alert inline-alert--error active-order-conflict" role="alert"><strong>Esta motocicleta ya tiene una orden abierta.</strong><span>Debes continuar la orden #{activeOrder.id} en lugar de crear otra.</span><StatusBadge status={activeOrder.status} /><Link className="text-link" to={`/orders/${activeOrder.id}`}>Abrir orden existente</Link></div> : null}
    </div>
  </section>
);
