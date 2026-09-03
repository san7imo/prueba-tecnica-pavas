export const LifecycleBadge = ({ lifecycle }) => (
  <span className={`lifecycle-badge lifecycle-badge--${lifecycle}`}>
    {lifecycle === 'deleted' ? 'Eliminado' : 'Activo'}
  </span>
);
