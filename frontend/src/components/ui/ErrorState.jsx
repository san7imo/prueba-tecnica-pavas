export const ErrorState = ({ message, onRetry }) => (
  <div className="state-panel state-panel--error" role="alert">
    <span className="state-panel__icon" aria-hidden="true">!</span>
    <div>
      <h2>No pudimos cargar la información</h2>
      <p>{message}</p>
    </div>
    {onRetry ? (
      <button className="button button--secondary" type="button" onClick={onRetry}>
        Reintentar
      </button>
    ) : null}
  </div>
);
