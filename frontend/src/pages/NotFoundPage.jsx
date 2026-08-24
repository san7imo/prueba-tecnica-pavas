import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <section className="state-panel state-panel--empty" aria-labelledby="not-found-title">
    <span className="state-panel__icon" aria-hidden="true">404</span>
    <div>
      <h1 id="not-found-title">Página no encontrada</h1>
      <p>La dirección solicitada no corresponde a una vista disponible.</p>
    </div>
    <Link className="button button--primary" to="/orders">Volver a órdenes</Link>
  </section>
);
