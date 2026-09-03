import { auditService } from '../services/auditService.js';
import { serializeAuditEvent } from '../utils/resourceSerializers.js';

export const listAuditEvents = async (request, response) => {
  const result = await auditService.listEvents(request.validated.query);
  response.json({
    data: result.events.map(serializeAuditEvent),
    meta: result.meta,
  });
};

export const getAuditEvent = async (request, response) => {
  const event = await auditService.getEvent(request.validated.params.id);
  response.json({ data: serializeAuditEvent(event) });
};
