export const EmptyState = ({ title, message, action }) => (
  <div className="state-panel state-panel--empty">
    <span className="state-panel__icon" aria-hidden="true">—</span>
    <div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
    {action}
  </div>
);
