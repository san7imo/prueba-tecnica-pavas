import { WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABELS } from '../../../constants/workOrders.js';

export const OrderFilters = ({ draft, onChange, onSubmit, onClear, disabled }) => (
  <form className="filters" onSubmit={onSubmit} aria-label="Filtros de órdenes">
    <div className="field field--compact filters__plate">
      <label htmlFor="order-client-document-filter">Cédula del cliente</label>
      <input
        id="order-client-document-filter"
        value={draft.clientDocumentNumber}
        onChange={(event) => onChange({
          ...draft,
          clientDocumentNumber: event.target.value,
        })}
        placeholder="Ej. 1020304050"
        maxLength={50}
        inputMode="numeric"
        disabled={disabled}
        autoFocus
      />
    </div>

    <div className="field field--compact">
      <label htmlFor="order-status-filter">Estado</label>
      <select
        id="order-status-filter"
        value={draft.status}
        onChange={(event) => onChange({ ...draft, status: event.target.value })}
        disabled={disabled}
      >
        <option value="">Todos los estados</option>
        {WORK_ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>{WORK_ORDER_STATUS_LABELS[status]}</option>
        ))}
      </select>
    </div>

    <div className="field field--compact filters__plate">
      <label htmlFor="order-plate-filter">Placa</label>
      <input
        id="order-plate-filter"
        value={draft.plate}
        onChange={(event) => onChange({ ...draft, plate: event.target.value })}
        placeholder="Ej. ABC123"
        maxLength={20}
        disabled={disabled}
      />
    </div>

    <div className="filters__actions">
      <button className="button button--primary" type="submit" disabled={disabled}>
        Aplicar filtros
      </button>
      <button className="button button--ghost" type="button" onClick={onClear} disabled={disabled}>
        Limpiar
      </button>
    </div>
  </form>
);
