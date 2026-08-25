export const Pagination = ({ meta, onPageChange, disabled, label = 'órdenes', singularLabel = 'orden', ariaLabel = 'Paginación de órdenes' }) => {
  const hasPrevious = meta.page > 1;
  const hasNext = meta.page < meta.totalPages;

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <p>
        Página <strong>{meta.page}</strong> de <strong>{Math.max(meta.totalPages, 1)}</strong>
        <span> · {meta.totalItems} {meta.totalItems === 1 ? singularLabel : label}</span>
      </p>
      <div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={disabled || !hasPrevious}
        >
          Anterior
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={disabled || !hasNext}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
};
