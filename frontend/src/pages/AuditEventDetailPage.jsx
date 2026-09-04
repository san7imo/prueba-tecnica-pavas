import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { auditApi } from '../api/auditApi.js';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '../constants/audit.js';
import { getApiErrorMessage } from '../utils/apiError.js';
import { formatDateTime } from '../utils/formatters.js';

const AuditData = ({ title, value }) => (
  <section className="panel audit-data" aria-labelledby={`audit-${title.toLowerCase().replace(' ', '-')}`}>
    <h2 id={`audit-${title.toLowerCase().replace(' ', '-')}`}>{title}</h2>
    {value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>Sin datos para este evento.</p>}
  </section>
);

export const AuditEventDetailPage = () => {
  const { id } = useParams();
  const [auditEvent, setAuditEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAuditEvent(await auditApi.getById(id));
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'No fue posible consultar el evento de auditoría.',
      ));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // The effect loads the immutable event selected by the route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvent();
  }, [loadEvent]);

  if (loading) return <div className="panel"><LoadingState message="Consultando evento de auditoría…" /></div>;
  if (error) return <div className="panel"><ErrorState message={error} onRetry={loadEvent} /></div>;

  return (
    <section aria-labelledby="audit-detail-title">
      <Link className="back-link" to="/admin/audit">← Volver a auditoría</Link>
      <div className="page-heading page-heading--detail">
        <div>
          <p className="eyebrow">Evento #{auditEvent.id}</p>
          <h1 id="audit-detail-title">{AUDIT_ACTION_LABELS[auditEvent.action] ?? auditEvent.action}</h1>
          <p>{AUDIT_ENTITY_LABELS[auditEvent.entityType] ?? auditEvent.entityType} #{auditEvent.entityId}</p>
        </div>
      </div>

      <dl className="panel audit-summary">
        <div><dt>Fecha</dt><dd>{formatDateTime(auditEvent.createdAt)}</dd></div>
        <div><dt>Actor</dt><dd>{auditEvent.actor.name} · Usuario #{auditEvent.actor.id}</dd></div>
        <div><dt>Motivo</dt><dd>{auditEvent.reason ?? 'Sin motivo registrado'}</dd></div>
      </dl>

      <div className="audit-data-grid">
        <AuditData title="Antes" value={auditEvent.beforeData} />
        <AuditData title="Después" value={auditEvent.afterData} />
        <AuditData title="Metadatos" value={auditEvent.metadata} />
      </div>
    </section>
  );
};
