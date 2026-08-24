import { WORK_ORDER_STATUS_LABELS, WORK_ORDER_TRANSITIONS } from '../../../constants/workOrders.js';

export const StatusActions = ({ status, onTransition, loadingStatus, error }) => {
  const allowed = WORK_ORDER_TRANSITIONS[status] ?? [];

  return (
    <section className="panel status-panel" aria-labelledby="status-actions-title">
      <div className="section-heading section-heading--compact">
        <div>
          <h2 id="status-actions-title">Actualizar estado</h2>
          <p>Solo se muestran transiciones válidas desde el estado actual.</p>
        </div>
      </div>
      {allowed.length === 0 ? (
        <p className="terminal-message" role="status">
          Esta orden está en un estado final y no admite más cambios.
        </p>
      ) : (
        <div className="status-actions">
          {allowed.map((target) => (
            <button
              key={target}
              className={`button ${target === 'CANCELADA' ? 'button--danger-ghost' : 'button--primary'}`}
              type="button"
              onClick={() => onTransition(target)}
              disabled={Boolean(loadingStatus)}
            >
              {loadingStatus === target ? 'Actualizando…' : target === 'CANCELADA' ? 'Cancelar orden' : `Mover a ${WORK_ORDER_STATUS_LABELS[target]}`}
            </button>
          ))}
        </div>
      )}
      {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}
    </section>
  );
};
