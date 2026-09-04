import { Link } from 'react-router-dom';

const FIELD_LABELS = { phone: 'teléfono', email: 'correo' };

export const DuplicateConflict = ({
  conflict,
  candidates,
  resourcePath = '/clients',
  onSelect,
}) => {
  if (!conflict) return null;
  const matchedFields = Array.isArray(conflict.details?.matchedFields)
    ? conflict.details.matchedFields.map((field) => FIELD_LABELS[field] ?? field).join(' y ')
    : 'datos de contacto';

  return (
    <div className="duplicate-conflict" role="alert">
      <strong>{conflict.code === 'CLIENT_RESTORE_REQUIRED' ? 'Existe un cliente eliminado que debe restaurarse.' : 'Revisa los posibles duplicados.'}</strong>
      <p>La coincidencia se encontró por {matchedFields}. Abre el registro antes de decidir.</p>
      {candidates.length ? (
        <ul>
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <span><strong>{candidate.name}</strong><small>{candidate.phone}{candidate.email ? ` · ${candidate.email}` : ''}</small></span>
              {onSelect && conflict.code === 'CLIENT_DUPLICATE_RISK' ? (
                <button className="button button--secondary" type="button" onClick={() => onSelect(candidate)}>Usar este cliente</button>
              ) : (
                <Link className="text-link" to={`${resourcePath}/${candidate.id}`}>Ver cliente</Link>
              )}
            </li>
          ))}
        </ul>
      ) : <p>No fue posible cargar el detalle de los candidatos. Puedes consultarlos desde Clientes.</p>}
    </div>
  );
};
