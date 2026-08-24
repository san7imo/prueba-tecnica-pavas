import { formatCurrency, multiplyDecimals } from '../../../utils/formatters.js';

export const ItemsTable = ({ items, onDelete, deletingItemId }) => {
  if (items.length === 0) {
    return (
      <div className="items-empty">
        <p><strong>Sin ítems registrados</strong></p>
        <p>Agrega mano de obra o repuestos para construir el total de la orden.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table data-table--items">
        <caption className="visually-hidden">Ítems de la orden</caption>
        <thead>
          <tr>
            <th scope="col">Tipo y descripción</th>
            <th scope="col">Cantidad</th>
            <th scope="col" className="align-right">Valor unitario</th>
            <th scope="col" className="align-right">Subtotal</th>
            <th scope="col"><span className="visually-hidden">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Ítem">
                <span className="item-type">{item.type === 'MANO_OBRA' ? 'Mano de obra' : 'Repuesto'}</span>
                <span className="cell-primary">{item.description}</span>
              </td>
              <td data-label="Cantidad">{item.count}</td>
              <td data-label="Valor unitario" className="align-right money">{formatCurrency(item.unitValue)}</td>
              <td data-label="Subtotal" className="align-right money">{formatCurrency(multiplyDecimals(item.count, item.unitValue))}</td>
              <td className="table-action">
                <button
                  className="text-button text-button--danger"
                  type="button"
                  onClick={() => onDelete(item)}
                  disabled={deletingItemId === item.id}
                  aria-label={`Eliminar ${item.description}`}
                >
                  {deletingItemId === item.id ? 'Eliminando…' : 'Eliminar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
