import { Link } from 'react-router-dom';

import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';

export const OrderTable = ({ orders }) => (
  <div className="table-scroll table-scroll--orders" role="region" aria-label="Tabla de órdenes de trabajo" tabIndex="0">
    <p className="table-scroll__hint">Desliza horizontalmente para ver todas las columnas.</p>
    <table className="data-table">
      <caption className="visually-hidden">Listado de órdenes de trabajo</caption>
      <thead>
        <tr>
          <th scope="col">Orden</th>
          <th scope="col">Placa</th>
          <th scope="col">Cliente</th>
          <th scope="col">Estado</th>
          <th scope="col">Ingreso</th>
          <th scope="col" className="align-right">Total</th>
          <th scope="col"><span className="visually-hidden">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td data-label="Orden"><strong>#{order.id}</strong></td>
            <td data-label="Placa"><span className="plate">{order.bike.plate}</span></td>
            <td data-label="Cliente">
              <span className="cell-primary">{order.bike.client.name}</span>
              <span className="cell-secondary">{order.bike.brand} {order.bike.model}</span>
            </td>
            <td data-label="Estado"><StatusBadge status={order.status} /></td>
            <td data-label="Ingreso">{formatDateTime(order.entryDate)}</td>
            <td data-label="Total" className="align-right money">{formatCurrency(order.total)}</td>
            <td className="table-action">
              <Link className="text-link" to={`/orders/${order.id}`} aria-label={`Ver orden ${order.id}`}>
                Ver detalle <span aria-hidden="true">→</span>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
