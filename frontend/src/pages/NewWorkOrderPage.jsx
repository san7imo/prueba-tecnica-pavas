import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { bikesApi } from '../api/bikesApi.js';
import { clientsApi } from '../api/clientsApi.js';
import { workOrdersApi } from '../api/workOrdersApi.js';
import { BikeLookup } from '../features/workOrders/components/BikeLookup.jsx';
import { QuickRegistration } from '../features/workOrders/components/QuickRegistration.jsx';
import { getApiErrorMessage } from '../utils/apiError.js';

const EMPTY_CLIENT = { name: '', phone: '', email: '' };
const EMPTY_BIKE = { plate: '', brand: '', model: '', cylinder: '' };

export const NewWorkOrderPage = () => {
  const navigate = useNavigate();
  const [plate, setPlate] = useState('');
  const [bikes, setBikes] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [bikeForm, setBikeForm] = useState(EMPTY_BIKE);
  const [createdClient, setCreatedClient] = useState(null);
  const [registrationError, setRegistrationError] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [bikeLoading, setBikeLoading] = useState(false);
  const [faultDescription, setFaultDescription] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

  const searchBike = async (event) => {
    event.preventDefault();
    if (!plate.trim() || searchLoading) return;
    setSearchLoading(true);
    setSearchError('');
    setSearched(false);
    setSelectedBike(null);
    setCreatedClient(null);
    setRegistrationError('');
    try {
      const result = await bikesApi.list(plate.trim());
      setBikes(result);
      setSearched(true);
      if (result.length === 1) setSelectedBike(result[0]);
      if (result.length === 0) setBikeForm({ ...EMPTY_BIKE, plate: plate.trim().toUpperCase() });
    } catch (error) {
      setBikes([]);
      setSearched(true);
      setSearchError(getApiErrorMessage(error, 'No fue posible buscar la moto.'));
    } finally {
      setSearchLoading(false);
    }
  };

  const changeClient = (event) => {
    setClientForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const createClient = async (event) => {
    event.preventDefault();
    if (clientLoading) return;
    setClientLoading(true);
    setRegistrationError('');
    try {
      const client = await clientsApi.create({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        ...(clientForm.email.trim() ? { email: clientForm.email.trim() } : {}),
      });
      setCreatedClient(client);
    } catch (error) {
      setRegistrationError(getApiErrorMessage(error, 'No fue posible registrar el cliente.'));
    } finally {
      setClientLoading(false);
    }
  };

  const changeBike = (event) => {
    setBikeForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const createBike = async (event) => {
    event.preventDefault();
    if (!createdClient || bikeLoading) return;
    setBikeLoading(true);
    setRegistrationError('');
    try {
      const bike = await bikesApi.create({
        plate: bikeForm.plate.trim(),
        brand: bikeForm.brand.trim(),
        model: bikeForm.model.trim(),
        ...(bikeForm.cylinder.trim() ? { cylinder: bikeForm.cylinder.trim() } : {}),
        clientId: createdClient.id,
      });
      setSelectedBike(bike);
      setBikes([bike]);
    } catch (error) {
      setRegistrationError(getApiErrorMessage(error, 'No fue posible registrar la moto.'));
    } finally {
      setBikeLoading(false);
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();
    if (!selectedBike || !faultDescription.trim() || orderLoading) return;
    setOrderLoading(true);
    setOrderError('');
    try {
      const order = await workOrdersApi.create({
        bikeId: selectedBike.id,
        faultDescription: faultDescription.trim(),
      });
      navigate(`/orders/${order.id}`, { state: { notice: `Orden #${order.id} creada correctamente.` } });
    } catch (error) {
      setOrderError(getApiErrorMessage(error, 'No fue posible crear la orden.'));
      setOrderLoading(false);
    }
  };

  const showRegistration = searched && bikes.length === 0 && !searchError;

  return (
    <section aria-labelledby="new-order-title">
      <div className="page-heading page-heading--with-back">
        <div>
          <Link className="back-link" to="/orders">← Volver a órdenes</Link>
          <p className="eyebrow">Ingreso al taller</p>
          <h1 id="new-order-title">Nueva orden de trabajo</h1>
          <p>Identifica la moto y registra el motivo principal de ingreso.</p>
        </div>
      </div>

      <div className="workflow">
        <BikeLookup
          plate={plate}
          onPlateChange={setPlate}
          onSearch={searchBike}
          loading={searchLoading}
          searched={searched}
          bikes={bikes}
          selectedBike={selectedBike}
          onSelect={setSelectedBike}
          error={searchError}
        />

        <QuickRegistration
          visible={showRegistration}
          clientForm={clientForm}
          onClientChange={changeClient}
          onClientSubmit={createClient}
          createdClient={createdClient}
          bikeForm={bikeForm}
          onBikeChange={changeBike}
          onBikeSubmit={createBike}
          clientLoading={clientLoading}
          bikeLoading={bikeLoading}
          error={registrationError}
        />

        <section className={`workflow-card${selectedBike ? '' : ' workflow-card--disabled'}`} aria-labelledby="order-data-title">
          <div className="workflow-card__number" aria-hidden="true">{showRegistration ? '3' : '2'}</div>
          <div className="workflow-card__content">
            <div className="section-heading">
              <div>
                <h2 id="order-data-title">Datos de la orden</h2>
                <p>{selectedBike ? `Moto seleccionada: ${selectedBike.plate} · ${selectedBike.client.name}` : 'Selecciona una moto para habilitar este paso.'}</p>
              </div>
            </div>
            <form onSubmit={createOrder}>
              <div className="field">
                <label htmlFor="fault-description">Descripción de la falla</label>
                <textarea
                  id="fault-description"
                  value={faultDescription}
                  onChange={(event) => setFaultDescription(event.target.value)}
                  rows="5"
                  maxLength={10000}
                  placeholder="Describe los síntomas reportados por el cliente…"
                  required
                  disabled={!selectedBike || orderLoading}
                  aria-describedby={`entry-date-help${orderError ? ' order-create-error' : ''}`}
                />
                <small id="entry-date-help">La fecha de ingreso será asignada por el servidor al crear la orden.</small>
              </div>
              {orderError ? <p id="order-create-error" className="inline-alert inline-alert--error" role="alert">{orderError}</p> : null}
              <div className="form-actions form-actions--end">
                <Link className="button button--ghost" to="/orders">Cancelar</Link>
                <button className="button button--primary button--prominent" type="submit" disabled={!selectedBike || !faultDescription.trim() || orderLoading}>
                  {orderLoading ? 'Creando orden…' : 'Crear orden de trabajo'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </section>
  );
};
