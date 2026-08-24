export const LoadingState = ({ message = 'Cargando información…' }) => (
  <div className="state-panel" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <p>{message}</p>
  </div>
);
