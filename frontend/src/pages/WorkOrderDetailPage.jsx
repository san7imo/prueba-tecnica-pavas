import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { workOrdersApi } from '../api/workOrdersApi.js';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { AssignmentPanel } from '../features/workOrders/components/AssignmentPanel.jsx';
import { ItemForm } from '../features/workOrders/components/ItemForm.jsx';
import { HistoryTimeline } from '../features/workOrders/components/HistoryTimeline.jsx';
import { ItemsTable } from '../features/workOrders/components/ItemsTable.jsx';
import { ReopenPanel } from '../features/workOrders/components/ReopenPanel.jsx';
import { StatusActions } from '../features/workOrders/components/StatusActions.jsx';
import {
  isWorkOrderRegression,
  OPEN_WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
} from '../constants/workOrders.js';
import { useAuth } from '../hooks/useAuth.js';
import { getApiError, getApiErrorMessage } from '../utils/apiError.js';
import { formatCurrency, formatDateTime } from '../utils/formatters.js';

const EMPTY_ITEM = { type: 'MANO_OBRA', description: '', count: '1.00', unitValue: '' };

export const WorkOrderDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? '');
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState('');
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [statusLoading, setStatusLoading] = useState('');
  const [statusError, setStatusError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const result = await workOrdersApi.getById(id);
      setOrder(result);
    } catch (error) {
      setLoadError(getApiError(error, 'No fue posible consultar la orden.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // The effect synchronizes the detail view with the route resource.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrder();
  }, [loadOrder]);

  const changeItem = (event) => {
    setItemForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const addItem = async (event) => {
    event.preventDefault();
    if (itemLoading) return;
    setItemLoading(true);
    setItemError('');
    setNotice('');
    try {
      await workOrdersApi.addItem(id, {
        type: itemForm.type,
        description: itemForm.description.trim(),
        count: itemForm.count,
        unitValue: itemForm.unitValue,
      });
      await loadOrder({ silent: true });
      setItemForm(EMPTY_ITEM);
      setNotice('Ítem agregado y total actualizado por el servidor.');
    } catch (error) {
      setItemError(getApiErrorMessage(error, 'No fue posible agregar el ítem.'));
    } finally {
      setItemLoading(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`¿Eliminar “${item.description}” de la orden?`)) return;
    setDeletingItemId(item.id);
    setItemError('');
    setNotice('');
    try {
      await workOrdersApi.deleteItem(item.id);
      await loadOrder({ silent: true });
      setNotice('Ítem eliminado y total actualizado por el servidor.');
    } catch (error) {
      setItemError(getApiErrorMessage(error, 'No fue posible eliminar el ítem.'));
    } finally {
      setDeletingItemId(null);
    }
  };

  const transitionStatus = async (target, note) => {
    const regression = isWorkOrderRegression(order.status, target);
    if (regression && !note.trim()) {
      setStatusError('Debes indicar el motivo para volver a una etapa anterior.');
      return;
    }
    const needsConfirmation = regression || target === 'CANCELADA' || target === 'ENTREGADA';
    if (needsConfirmation) {
      const message = regression
        ? `¿Confirmas devolver la orden de ${WORK_ORDER_STATUS_LABELS[order.status]} a ${WORK_ORDER_STATUS_LABELS[target]}? El motivo quedará registrado.`
        : `¿Confirmas que deseas ${target === 'CANCELADA' ? 'cancelar' : 'marcar como entregada'} esta orden?`;
      if (!window.confirm(message)) return;
    }
    setStatusLoading(target);
    setStatusError('');
    setNotice('');
    try {
      await workOrdersApi.updateStatus(id, target, note);
      await loadOrder({ silent: true });
      setHistoryVersion((current) => current + 1);
      setNotice(`Estado actualizado a ${WORK_ORDER_STATUS_LABELS[target]}.`);
    } catch (error) {
      setStatusError(getApiErrorMessage(error, 'No fue posible actualizar el estado.'));
    } finally {
      setStatusLoading('');
    }
  };

  const assignmentChanged = (updatedOrder) => {
    setOrder(updatedOrder);
    setNotice(updatedOrder.assignedMechanic
      ? `Responsable actualizado a ${updatedOrder.assignedMechanic.name}.`
      : 'La orden quedó sin responsable.');
  };

  const orderReopened = (updatedOrder) => {
    setOrder(updatedOrder);
    setHistoryVersion((current) => current + 1);
    setStatusError('');
    setNotice('Orden reabierta en Diagnóstico. El motivo quedó registrado.');
  };

  if (loading) return <LoadingState message="Cargando detalle de la orden…" />;

  if (loadError) {
    if (loadError.status === 404 || loadError.code === 'WORK_ORDER_NOT_FOUND') {
      return (
        <section className="state-panel state-panel--empty" aria-labelledby="missing-order-title">
          <span className="state-panel__icon" aria-hidden="true">404</span>
          <div><h1 id="missing-order-title">Orden no encontrada</h1><p>{loadError.message}</p></div>
          <Link className="button button--secondary" to="/orders">Volver al listado</Link>
        </section>
      );
    }
    return <ErrorState message={loadError.message} onRetry={loadOrder} />;
  }

  const orderOpen = OPEN_WORK_ORDER_STATUSES.includes(order.status);

  return (
    <section aria-labelledby="order-detail-title">
      <div className="page-heading page-heading--detail">
        <div>
          <Link className="back-link" to="/orders">← Volver a órdenes</Link>
          <p className="eyebrow">Orden de trabajo</p>
          <div className="title-with-status">
            <h1 id="order-detail-title">Orden #{order.id}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p>Ingresó {formatDateTime(order.entryDate)}</p>
        </div>
        <div className="total-card" aria-label={`Total de la orden ${formatCurrency(order.total)}`}>
          <span>Total de la orden</span>
          <strong>{formatCurrency(order.total)}</strong>
          <small>Calculado por el servidor</small>
        </div>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel" aria-labelledby="service-info-title">
            <div className="section-heading section-heading--compact">
              <div><h2 id="service-info-title">Servicio solicitado</h2></div>
            </div>
            <p className="fault-description">{order.faultDescription}</p>
          </section>

          <section className="panel" aria-labelledby="items-title">
            <div className="section-heading section-heading--compact">
              <div><h2 id="items-title">Ítems de la orden</h2><p>{order.items.length} {order.items.length === 1 ? 'registro' : 'registros'}</p></div>
            </div>
            <ItemsTable
              items={order.items}
              onDelete={deleteItem}
              deletingItemId={deletingItemId}
              canDelete={user.role === 'ADMIN' && orderOpen}
              isOpen={orderOpen}
            />
            {orderOpen ? (
              <ItemForm form={itemForm} onChange={changeItem} onSubmit={addItem} loading={itemLoading} error={itemError} />
            ) : (
              <p className="terminal-message item-lifecycle-message" role="status">
                La orden está cerrada: sus ítems y su total quedan protegidos.
              </p>
            )}
          </section>
          <HistoryTimeline key={`${id}-${historyVersion}`} workOrderId={id} />
        </div>

        <aside className="detail-aside" aria-label="Información relacionada">
          <section className="panel resource-card" aria-labelledby="bike-info-title">
            <p className="card-label">Moto</p>
            <h2 id="bike-info-title" className="plate plate--large">{order.bike.plate}</h2>
            <dl>
              <div><dt>Marca y modelo</dt><dd>{order.bike.brand} {order.bike.model}</dd></div>
              <div><dt>Cilindraje</dt><dd>{order.bike.cylinder || 'No registrado'}</dd></div>
            </dl>
          </section>
          <section className="panel resource-card" aria-labelledby="client-info-title">
            <p className="card-label">Cliente</p>
            <h2 id="client-info-title">{order.bike.client.name}</h2>
            <dl>
              <div><dt>Teléfono</dt><dd>{order.bike.client.phone}</dd></div>
              <div><dt>Correo</dt><dd>{order.bike.client.email || 'No registrado'}</dd></div>
            </dl>
          </section>
          {user.role === 'ADMIN' ? (
            <AssignmentPanel order={order} onChanged={assignmentChanged} />
          ) : (
            <section className="panel resource-card" aria-labelledby="mechanic-info-title">
              <p className="card-label">Responsable</p>
              <h2 id="mechanic-info-title">{order.assignedMechanic?.name ?? 'Sin asignar'}</h2>
              <p>Esta orden está asignada a tu cuenta.</p>
            </section>
          )}
          {user.role === 'ADMIN' && order.status === 'ENTREGADA' ? (
            <ReopenPanel order={order} onReopened={orderReopened} />
          ) : null}
          <StatusActions key={`${order.status}-${historyVersion}`} status={order.status} role={user.role} onTransition={transitionStatus} loadingStatus={statusLoading} error={statusError} />
        </aside>
      </div>
    </section>
  );
};
