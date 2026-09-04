import { useState } from 'react';

import { workOrdersApi } from '../../../api/workOrdersApi.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';

const REOPEN_OPTIONS = Object.freeze([
  { value: 'WARRANTY', label: 'Garantía' },
  { value: 'SAME_ISSUE', label: 'Misma falla' },
]);

export const ReopenPanel = ({ order, onReopened }) => {
  const [type, setType] = useState(REOPEN_OPTIONS[0].value);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !reason.trim()) return;
    const typeLabel = REOPEN_OPTIONS.find((option) => option.value === type)?.label;
    if (!window.confirm(
      `¿Confirmas reabrir la orden por ${typeLabel}? Volverá a Diagnóstico y el motivo quedará registrado.`,
    )) return;

    setSubmitting(true);
    setError('');
    try {
      const updatedOrder = await workOrdersApi.reopen(order.id, type, reason);
      onReopened(updatedOrder);
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'No fue posible reabrir la orden.',
      ));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel reopen-panel" aria-labelledby="reopen-title">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="card-label">Garantía o recurrencia</p>
          <h2 id="reopen-title">Reabrir orden</h2>
          <p>Úsalo solo cuando persiste la misma falla o aplica la garantía.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="reopen-type">Tipo de reapertura</label>
          <select
            id="reopen-type"
            value={type}
            onChange={(event) => { setType(event.target.value); setError(''); }}
            disabled={submitting}
          >
            {REOPEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="field reopen-reason">
          <label htmlFor="reopen-reason">
            Motivo de reapertura
            <span className="required-mark" aria-hidden="true"> *</span>
          </label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(event) => { setReason(event.target.value); setError(''); }}
            required
            maxLength="1000"
            disabled={submitting}
            placeholder="Describe por qué corresponde continuar sobre esta misma orden"
            aria-describedby="reopen-reason-limit"
          />
          <small id="reopen-reason-limit" className="field__meta">
            {reason.length}/1000 caracteres
          </small>
        </div>
        {error ? (
          <p className="inline-alert inline-alert--error" role="alert">{error}</p>
        ) : null}
        <div className="form-actions form-actions--end">
          <button
            className="button button--secondary"
            type="submit"
            disabled={submitting || !reason.trim()}
          >
            {submitting ? 'Reabriendo…' : 'Reabrir en diagnóstico'}
          </button>
        </div>
      </form>
    </section>
  );
};
