import { WORK_ORDER_ITEM_TYPES } from '../../../constants/workOrders.js';

export const ItemForm = ({ form, onChange, onSubmit, loading, error }) => (
  <form className="item-form" onSubmit={onSubmit} aria-labelledby="add-item-title">
    <div className="section-heading section-heading--compact">
      <div>
        <h3 id="add-item-title">Agregar ítem</h3>
        <p>Registra mano de obra o repuestos utilizados.</p>
      </div>
    </div>
    <div className="form-grid form-grid--item">
      <div className="field">
        <label htmlFor="item-type">Tipo</label>
        <select id="item-type" name="type" value={form.type} onChange={onChange} disabled={loading} aria-describedby={error ? 'item-form-error' : undefined}>
          {WORK_ORDER_ITEM_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>
      <div className="field field--description">
        <label htmlFor="item-description">Descripción</label>
        <input id="item-description" name="description" value={form.description} onChange={onChange} required maxLength={255} disabled={loading} aria-describedby={error ? 'item-form-error' : undefined} />
      </div>
      <div className="field">
        <label htmlFor="item-count">Cantidad</label>
        <input id="item-count" name="count" value={form.count} onChange={onChange} required inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="1.00" disabled={loading} aria-describedby={error ? 'item-form-error' : undefined} />
      </div>
      <div className="field">
        <label htmlFor="item-unit-value">Valor unitario</label>
        <input id="item-unit-value" name="unitValue" value={form.unitValue} onChange={onChange} required inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="50000.00" disabled={loading} aria-describedby={error ? 'item-form-error' : undefined} />
      </div>
    </div>
    {error ? <p id="item-form-error" className="inline-alert inline-alert--error" role="alert">{error}</p> : null}
    <div className="form-actions form-actions--end">
      <button className="button button--secondary" type="submit" disabled={loading || !form.description.trim() || !form.count || !form.unitValue}>
        {loading ? 'Agregando…' : 'Agregar ítem'}
      </button>
    </div>
  </form>
);
