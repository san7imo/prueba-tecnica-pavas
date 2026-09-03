import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../constants/audit.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { auditRepository } from '../repositories/auditRepository.js';
import {
  buildAuditSnapshot,
  sanitizeAuditMetadata,
} from '../utils/auditSnapshots.js';

const MAX_REASON_LENGTH = 1000;

const auditEventNotFound = () =>
  new NotFoundError({
    code: 'AUDIT_EVENT_NOT_FOUND',
    message: 'Audit event not found.',
  });

const authenticatedActorId = (actor) => {
  const actorId = actor?.id;
  const normalized = actorId === undefined || actorId === null ? '' : String(actorId);
  if (!/^[1-9]\d{0,19}$/.test(normalized)) {
    throw new TypeError('Authenticated audit actor is required.');
  }
  return normalized;
};

const normalizedReason = (reason) => {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== 'string') throw new TypeError('Audit reason must be a string.');
  const value = reason.trim();
  if (value.length > MAX_REASON_LENGTH) {
    throw new TypeError(`Audit reason must be at most ${MAX_REASON_LENGTH} characters.`);
  }
  return value || null;
};

export const auditService = {
  record(
    {
      entityType,
      action,
      actor,
      before = null,
      after = null,
      metadata = null,
      reason = null,
    },
    transaction,
  ) {
    if (!AUDIT_ENTITY_TYPES.includes(entityType)) {
      throw new TypeError(`Unsupported audit entity type: ${entityType}`);
    }
    if (!AUDIT_ACTIONS.includes(action)) {
      throw new TypeError(`Unsupported audit action: ${action}`);
    }
    if (!transaction) throw new TypeError('Audit writes require a domain transaction.');

    const beforeData = buildAuditSnapshot(entityType, before);
    const afterData = buildAuditSnapshot(entityType, after);
    const entityId = afterData?.id ?? beforeData?.id;
    if (!entityId) throw new TypeError('Audited resource id is required.');

    return auditRepository.create(
      {
        entityType,
        entityId,
        action,
        actorUserId: authenticatedActorId(actor),
        beforeData,
        afterData,
        metadata: sanitizeAuditMetadata({ entityType, action, metadata }),
        reason: normalizedReason(reason),
      },
      transaction,
    );
  },

  async listEvents(filters) {
    const { count, rows } = await auditRepository.findPaginated(filters);
    return {
      events: rows,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: count,
        totalPages: Math.ceil(count / filters.pageSize),
      },
    };
  },

  async getEvent(id) {
    const event = await auditRepository.findById(id);
    if (!event) throw auditEventNotFound();
    return event;
  },
};
