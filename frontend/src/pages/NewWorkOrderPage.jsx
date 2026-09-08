import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { clientsApi } from '../api/clientsApi.js';
import { usersApi } from '../api/usersApi.js';
import { workOrdersApi } from '../api/workOrdersApi.js';
import { ClientSelector } from '../components/clients/ClientSelector.jsx';
import { BikeLookup } from '../features/workOrders/components/BikeLookup.jsx';
import { QuickRegistration } from '../features/workOrders/components/QuickRegistration.jsx';
import { getApiError } from '../utils/apiError.js';

const EMPTY_CLIENT = { documentNumber: '', name: '', phone: '', email: '' };
const EMPTY_BIKE = { plate: '', brand: '', model: '', cylinder: '' };
const DUPLICATE_CODES = new Set([
  'CLIENT_DOCUMENT_ALREADY_EXISTS',
  'CLIENT_DUPLICATE_RISK',
  'CLIENT_RESTORE_REQUIRED',
]);

const activeResources = (resources) =>
  resources.filter((resource) => resource.lifecycle !== 'deleted');

export const NewWorkOrderPage = () => {
  const navigate = useNavigate();
  const clientSubmitting = useRef(false);
  const bikeSubmitting = useRef(false);
  const orderSubmitting = useRef(false);
  const bikeLoadSequence = useRef(0);
  const bikeCheckSequence = useRef(0);

  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientRegistration, setShowClientRegistration] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [duplicateReason, setDuplicateReason] = useState('');

  const [bikes, setBikes] = useState([]);
  const [bikesLoading, setBikesLoading] = useState(false);
  const [bikeError, setBikeError] = useState(null);
  const [showBikeRegistration, setShowBikeRegistration] = useState(false);
  const [bikeForm, setBikeForm] = useState(EMPTY_BIKE);
  const [bikeLoading, setBikeLoading] = useState(false);
  const [selectedBike, setSelectedBike] = useState(null);
  const [bikeChecking, setBikeChecking] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  const [mechanics, setMechanics] = useState([]);
  const [mechanicsLoading, setMechanicsLoading] = useState(true);
  const [mechanicsError, setMechanicsError] = useState('');
  const [assignedMechanicId, setAssignedMechanicId] = useState('');
  const [faultDescription, setFaultDescription] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const loadMechanics = useCallback(async () => {
    setMechanicsLoading(true);
    setMechanicsError('');
    try {
      const users = await usersApi.list();
      const activeMechanics = users.filter((user) =>
        user.role === 'MECANICO' && user.active);
      setMechanics(activeMechanics);
      setAssignedMechanicId((current) =>
        current && !activeMechanics.some(({ id }) => String(id) === current)
          ? ''
          : current);
    } catch (error) {
      setMechanics([]);
      setAssignedMechanicId('');
      setMechanicsError(getApiError(
        error,
        'No fue posible consultar los mecánicos. Puedes crear la orden sin asignar.',
      ).message);
    } finally {
      setMechanicsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the optional assignee catalogue once when the ADMIN flow opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMechanics();
  }, [loadMechanics]);

  const resetBikeStep = () => {
    bikeLoadSequence.current += 1;
    bikeCheckSequence.current += 1;
    setBikes([]);
    setBikesLoading(false);
    setBikeError(null);
    setShowBikeRegistration(false);
    setBikeForm(EMPTY_BIKE);
    setSelectedBike(null);
    setBikeChecking(false);
    setActiveOrder(null);
    setOrderError(null);
  };

  const loadClientBikes = async (clientId) => {
    const sequence = ++bikeLoadSequence.current;
    setBikesLoading(true);
    setBikeError(null);
    try {
      const result = await bikesApi.list({
        clientId,
        lifecycle: 'active',
        pageSize: 100,
      });
      if (sequence === bikeLoadSequence.current) {
        setBikes(activeResources(result.data));
      }
    } catch (error) {
      if (sequence === bikeLoadSequence.current) {
        setBikes([]);
        setBikeError(getApiError(
          error,
          'No fue posible consultar las motocicletas del cliente.',
        ));
      }
    } finally {
      if (sequence === bikeLoadSequence.current) setBikesLoading(false);
    }
  };

  const selectClient = (client) => {
    if (!client || client.lifecycle === 'deleted') {
      setSelectedClient(null);
      resetBikeStep();
      return;
    }
    setSelectedClient(client);
    setShowClientRegistration(false);
    setClientError(null);
    setDuplicateCandidates([]);
    setDuplicateReason('');
    resetBikeStep();
    loadClientBikes(client.id);
  };

  const loadDuplicateCandidates = async (candidateIds = []) => {
    const settled = await Promise.allSettled(
      candidateIds.map((candidateId) => clientsApi.getById(candidateId)),
    );
    setDuplicateCandidates(
      settled
        .filter(({ status }) => status === 'fulfilled')
        .map(({ value }) => value),
    );
  };

  const changeClient = (event) => {
    setClientForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const createClient = async (event, confirmDuplicate = false) => {
    event?.preventDefault();
    if (clientSubmitting.current) return;
    clientSubmitting.current = true;
    setClientLoading(true);
    setClientError(null);
    setDuplicateCandidates([]);
    try {
      const client = await clientsApi.create({
        documentNumber: clientForm.documentNumber.trim(),
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        ...(clientForm.email.trim() ? { email: clientForm.email.trim() } : {}),
        ...(confirmDuplicate
          ? { confirmDuplicate: true, duplicateReason: duplicateReason.trim() }
          : {}),
      });
      setClientForm(EMPTY_CLIENT);
      selectClient(client);
    } catch (error) {
      const apiError = getApiError(error, 'No fue posible registrar el cliente.');
      setClientError(apiError);
      if (DUPLICATE_CODES.has(apiError.code)) {
        await loadDuplicateCandidates(apiError.details?.candidateIds);
      }
    } finally {
      clientSubmitting.current = false;
      setClientLoading(false);
    }
  };

  const changeBike = (event) => {
    setBikeForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const createBike = async (event) => {
    event.preventDefault();
    if (!selectedClient || bikeSubmitting.current) return;
    bikeSubmitting.current = true;
    setBikeLoading(true);
    setBikeError(null);
    try {
      const bike = await bikesApi.create({
        plate: bikeForm.plate.trim(),
        brand: bikeForm.brand.trim(),
        model: bikeForm.model.trim(),
        ...(bikeForm.cylinder.trim()
          ? { cylinder: bikeForm.cylinder.trim() }
          : {}),
        clientId: selectedClient.id,
      });
      setBikeForm(EMPTY_BIKE);
      setShowBikeRegistration(false);
      setBikes((current) => [bike, ...current]);
      setSelectedBike(bike);
      setActiveOrder(null);
      setOrderError(null);
    } catch (error) {
      setBikeError(getApiError(error, 'No fue posible registrar la motocicleta.'));
    } finally {
      bikeSubmitting.current = false;
      setBikeLoading(false);
    }
  };

  const selectBike = async (bike) => {
    if (bike.lifecycle === 'deleted') return;
    const sequence = ++bikeCheckSequence.current;
    setShowBikeRegistration(false);
    setSelectedBike(bike);
    setBikeChecking(true);
    setBikeError(null);
    setActiveOrder(null);
    setOrderError(null);
    try {
      const detail = await bikesApi.getById(bike.id);
      if (sequence !== bikeCheckSequence.current) return;
      if (detail.lifecycle === 'deleted') {
        setSelectedBike(null);
        setBikeError({ message: 'La motocicleta fue eliminada y no puede recibir órdenes.' });
        return;
      }
      setSelectedBike(detail);
      setActiveOrder(detail.currentOpenOrder ?? null);
    } catch (error) {
      if (sequence === bikeCheckSequence.current) {
        setSelectedBike(null);
        setBikeError(getApiError(
          error,
          'No fue posible comprobar la motocicleta seleccionada.',
        ));
      }
    } finally {
      if (sequence === bikeCheckSequence.current) setBikeChecking(false);
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();
    if (
      !selectedBike ||
      activeOrder ||
      !faultDescription.trim() ||
      orderSubmitting.current
    ) return;
    orderSubmitting.current = true;
    setOrderLoading(true);
    setOrderError(null);
    try {
      const selectedMechanic = mechanics.find((mechanic) =>
        String(mechanic.id) === assignedMechanicId);
      const order = await workOrdersApi.create({
        bikeId: selectedBike.id,
        faultDescription: faultDescription.trim(),
        ...(selectedMechanic
          ? { assignedMechanicId: selectedMechanic.id }
          : {}),
      });
      navigate(`/orders/${order.id}`, {
        state: { notice: `Orden #${order.id} creada correctamente.` },
      });
    } catch (error) {
      const apiError = getApiError(error, 'No fue posible crear la orden.');
      if (apiError.code === 'BIKE_HAS_ACTIVE_WORK_ORDER') {
        apiError.message = 'Esta motocicleta ya tiene una orden abierta. Actualiza la selección y continúa esa orden.';
        try {
          const detail = await bikesApi.getById(selectedBike.id);
          setSelectedBike(detail);
          setActiveOrder(detail.currentOpenOrder ?? null);
        } catch {
          // Preserve the authoritative create conflict even if detail refresh fails.
        }
      }
      if (
        ['MECHANIC_INACTIVE', 'ASSIGNEE_MUST_BE_MECHANIC', 'MECHANIC_NOT_FOUND']
          .includes(apiError.code)
      ) {
        apiError.message = 'El mecánico seleccionado ya no está disponible. Elige otro responsable o deja la orden sin asignar.';
        setAssignedMechanicId('');
        loadMechanics();
      }
      setOrderError(apiError);
    } finally {
      orderSubmitting.current = false;
      setOrderLoading(false);
    }
  };

  const orderDisabled = !selectedBike || bikeChecking || bikeLoading ||
    showBikeRegistration || Boolean(activeOrder);

  return (
    <section aria-labelledby="new-order-title">
      <div className="page-heading page-heading--with-back">
        <div>
          <Link className="back-link" to="/orders">← Volver a órdenes</Link>
          <p className="eyebrow">Ingreso al taller</p>
          <h1 id="new-order-title">Nueva orden de trabajo</h1>
          <p>Reutiliza primero el cliente y la motocicleta antes de registrar datos nuevos.</p>
        </div>
      </div>

      <div className="workflow">
        <section className="workflow-card" aria-labelledby="client-step-title">
          <div className="workflow-card__number" aria-hidden="true">1</div>
          <div className="workflow-card__content">
            <div className="section-heading">
              <div>
                <h2 id="client-step-title">Selecciona el cliente</h2>
                <p>Busca primero por cédula; nombre, teléfono y correo quedan como alternativas.</p>
              </div>
              {selectedClient ? <span className="step-complete">Seleccionado</span> : null}
            </div>
            <ClientSelector
              selected={selectedClient}
              onSelect={selectClient}
              disabled={clientLoading || bikesLoading || orderLoading}
              emptyAction={<button className="button button--secondary" type="button" onClick={() => { setShowClientRegistration(true); setClientError(null); }}>Registrar cliente nuevo</button>}
            />
            <QuickRegistration
              mode="client"
              visible={showClientRegistration && !selectedClient}
              clientForm={clientForm}
              onClientChange={changeClient}
              onClientSubmit={createClient}
              clientLoading={clientLoading}
              clientError={clientError}
              candidates={duplicateCandidates}
              onSelectCandidate={selectClient}
              duplicateReason={duplicateReason}
              onDuplicateReasonChange={setDuplicateReason}
              onConfirmDuplicate={(event) => createClient(event, true)}
              onCancel={() => { setShowClientRegistration(false); setClientError(null); setDuplicateCandidates([]); }}
            />
          </div>
        </section>

        <BikeLookup
          client={selectedClient}
          loading={bikesLoading}
          bikes={bikes}
          selectedBike={selectedBike}
          onSelect={selectBike}
          onCreate={() => { setShowBikeRegistration(true); setBikeError(null); }}
          onRetry={() => selectedClient && loadClientBikes(selectedClient.id)}
          error={bikeError?.message ?? ''}
          checking={bikeChecking}
          activeOrder={activeOrder}
          disabled={orderLoading || bikeLoading}
        />

        <QuickRegistration
          mode="bike"
          visible={showBikeRegistration && Boolean(selectedClient)}
          selectedClient={selectedClient}
          bikeForm={bikeForm}
          onBikeChange={changeBike}
          onBikeSubmit={createBike}
          bikeLoading={bikeLoading}
          bikeError={bikeError}
          onCancel={() => { setShowBikeRegistration(false); setBikeError(null); }}
        />

        <section className={`workflow-card${orderDisabled ? ' workflow-card--disabled' : ''}`} aria-labelledby="order-data-title">
          <div className="workflow-card__number" aria-hidden="true">3</div>
          <div className="workflow-card__content">
            <div className="section-heading">
              <div>
                <h2 id="order-data-title">Completa la orden</h2>
                <p>{selectedBike ? `Motocicleta: ${selectedBike.plate} · Cliente: ${selectedClient.name}` : 'Selecciona una motocicleta disponible para continuar.'}</p>
              </div>
            </div>
            <form onSubmit={createOrder}>
              <div className="form-grid">
                <div className="field field--span-2">
                  <label htmlFor="fault-description">Descripción de la falla<span className="required-mark" aria-hidden="true"> *</span></label>
                  <textarea id="fault-description" value={faultDescription} onChange={(event) => { setFaultDescription(event.target.value); setOrderError(null); }} rows="5" maxLength="10000" placeholder="Describe los síntomas reportados por el cliente…" required disabled={orderDisabled || orderLoading} aria-describedby={`entry-date-help${orderError ? ' order-create-error' : ''}`} />
                  <small id="entry-date-help">La fecha de ingreso será asignada por el servidor.</small>
                </div>
                <div className="field field--span-2">
                  <label htmlFor="assigned-mechanic">Mecánico responsable <span>(opcional)</span></label>
                  <select id="assigned-mechanic" value={assignedMechanicId} onChange={(event) => { setAssignedMechanicId(event.target.value); setOrderError(null); }} disabled={orderDisabled || orderLoading || mechanicsLoading}>
                    <option value="">Sin asignar por ahora</option>
                    {mechanics.map((mechanic) => <option key={mechanic.id} value={String(mechanic.id)}>{mechanic.name}</option>)}
                  </select>
                  {mechanicsLoading ? <small role="status">Consultando mecánicos activos…</small> : null}
                  {!mechanicsLoading && !mechanicsError && mechanics.length === 0 ? <small>No hay mecánicos activos; la orden quedará sin asignar.</small> : null}
                </div>
              </div>
              {mechanicsError ? <div className="inline-alert inline-alert--error" role="alert"><span>{mechanicsError}</span><button className="text-button" type="button" onClick={loadMechanics}>Reintentar</button></div> : null}
              {orderError ? <p id="order-create-error" className="inline-alert inline-alert--error" role="alert">{orderError.message}</p> : null}
              <div className="form-actions form-actions--end">
                <Link className="button button--ghost" to="/orders">Cancelar</Link>
                <button className="button button--primary button--prominent" type="submit" disabled={orderDisabled || !faultDescription.trim() || orderLoading}>{orderLoading ? 'Creando orden…' : 'Crear orden de trabajo'}</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </section>
  );
};
