import { useCallback, useEffect, useMemo, useState } from 'react';

import { usersApi } from '../../../api/usersApi.js';
import { workOrdersApi } from '../../../api/workOrdersApi.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';

const CLOSED_STATUSES = new Set(['ENTREGADA', 'CANCELADA']);

export const AssignmentPanel = ({ order, onChanged }) => {
  const currentId = order.assignedMechanicId ?? null;
  const closed = CLOSED_STATUSES.has(order.status);
  const [mechanics, setMechanics] = useState([]);
  const [targetId, setTargetId] = useState(currentId === null ? '' : String(currentId));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadMechanics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const users = await usersApi.list();
      setMechanics(users.filter(({ role, active }) => role === 'MECANICO' && active));
    } catch (requestError) {
      setMechanics([]);
      setError(getApiErrorMessage(
        requestError,
        'No fue posible consultar los mecánicos activos.',
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Synchronize the assignment editor with the persisted order and catalogue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetId(currentId === null ? '' : String(currentId));
    setReason('');
    if (closed) {
      setLoading(false);
      return;
    }
    loadMechanics();
  }, [closed, currentId, loadMechanics]);

  const targetMechanicId = targetId === '' ? null : Number(targetId);
  const changed = String(targetMechanicId ?? '') !== String(currentId ?? '');
  const reasonRequired = changed && currentId !== null;
  const currentMissing = currentId !== null && !mechanics.some(
    ({ id }) => String(id) === String(currentId),
  );
  const currentName = order.assignedMechanic?.name ?? `Mecánico #${currentId}`;
  const targetName = useMemo(
    () => mechanics.find(({ id }) => String(id) === targetId)?.name ?? 'Sin asignar',
    [mechanics, targetId],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!changed || submitting || (reasonRequired && !reason.trim())) return;
    if (
      reasonRequired &&
      !window.confirm(`¿Confirmas el cambio de responsable a ${targetName}?`)
    ) return;

    setSubmitting(true);
    setError('');
    try {
      const updated = await workOrdersApi.changeAssignment(
        order.id,
        targetMechanicId,
        reason,
      );
      onChanged(updated);
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'No fue posible actualizar el responsable.',
      ));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel assignment-panel" aria-labelledby="assignment-title">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="card-label">Responsable</p>
          <h2 id="assignment-title">{order.assignedMechanic?.name ?? 'Sin asignar'}</h2>
          <p>{closed
            ? 'La orden está cerrada y conserva su último responsable.'
            : 'Asigna una sola persona responsable del trabajo.'}</p>
        </div>
      </div>

      {!closed ? (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="assignment-mechanic">Nuevo responsable</label>
            <select id="assignment-mechanic" value={targetId} onChange={(event) => { setTargetId(event.target.value); setError(''); }} disabled={loading || submitting}>
              <option value="">Sin asignar</option>
              {currentMissing ? <option value={String(currentId)} disabled>{currentName} (no disponible)</option> : null}
              {mechanics.map((mechanic) => <option key={mechanic.id} value={String(mechanic.id)}>{mechanic.name}</option>)}
            </select>
            {loading ? <small role="status">Consultando mecánicos activos…</small> : null}
          </div>
          {reasonRequired ? (
            <div className="field assignment-reason">
              <label htmlFor="assignment-reason">Motivo del cambio<span className="required-mark" aria-hidden="true"> *</span></label>
              <textarea id="assignment-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength="1000" disabled={submitting} />
            </div>
          ) : null}
          {error ? <div className="inline-alert inline-alert--error" role="alert"><span>{error}</span>{!submitting && mechanics.length === 0 ? <button className="text-button" type="button" onClick={loadMechanics}>Reintentar</button> : null}</div> : null}
          <div className="form-actions form-actions--end">
            <button className="button button--secondary" type="submit" disabled={loading || submitting || !changed || (reasonRequired && !reason.trim())}>{submitting ? 'Actualizando…' : 'Guardar responsable'}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
