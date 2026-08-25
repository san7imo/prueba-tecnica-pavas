import { useState } from 'react';

import { WORK_ORDER_TRANSITION_ACTION_LABELS, WORK_ORDER_TRANSITIONS } from '../../../constants/workOrders.js';

const MECHANIC_TARGETS = new Set(['DIAGNOSTICO', 'EN_PROCESO', 'LISTA']);

export const StatusActions = ({ status, role, onTransition, loadingStatus, error }) => {
  const [note, setNote] = useState('');
  const workflowAllowed = WORK_ORDER_TRANSITIONS[status] ?? [];
  const allowed = role === 'ADMIN'
    ? workflowAllowed
    : workflowAllowed.filter((target) => MECHANIC_TARGETS.has(target));

  return (
    <section className="panel status-panel" aria-labelledby="status-actions-title">
      <div className="section-heading section-heading--compact">
        <div>
          <h2 id="status-actions-title">Actualizar estado</h2>
          <p>Solo se muestran transiciones válidas desde el estado actual.</p>
        </div>
      </div>
      {workflowAllowed.length === 0 ? (
        <p className="terminal-message" role="status">
          Esta orden está en un estado final y no admite más cambios.
        </p>
      ) : allowed.length === 0 ? (
        <p className="terminal-message" role="status">
          Tu rol no permite las transiciones disponibles desde este estado.
        </p>
      ) : (
        <>
          <div className="field status-note">
            <label htmlFor="transition-note">Nota <span>(opcional)</span></label>
            <textarea id="transition-note" value={note} maxLength="1000" onChange={(event) => setNote(event.target.value)} disabled={Boolean(loadingStatus)} placeholder="Contexto para el historial de la orden" aria-describedby="transition-note-limit" />
            <small id="transition-note-limit" className="field__meta">{note.length}/1000 caracteres</small>
          </div>
          <div className="status-actions">
            {allowed.map((target) => (
              <button
                key={target}
                className={`button ${target === 'CANCELADA' ? 'button--danger-ghost' : 'button--primary'}`}
                type="button"
                onClick={() => onTransition(target, note)}
                disabled={Boolean(loadingStatus)}
              >
                {loadingStatus === target ? 'Actualizando…' : WORK_ORDER_TRANSITION_ACTION_LABELS[target]}
              </button>
            ))}
          </div>
        </>
      )}
      {error ? <p className="inline-alert inline-alert--error" role="alert">{error}</p> : null}
    </section>
  );
};
