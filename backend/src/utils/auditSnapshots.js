import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  AUDIT_TRANSITION_KIND,
} from '../constants/audit.js';
import { USER_ROLES } from '../constants/auth.js';

const plain = (resource) =>
  typeof resource?.get === 'function' ? resource.get({ plain: true }) : resource;

const asId = (value) => (value === null || value === undefined ? null : String(value));
const asDate = (value) =>
  value === null || value === undefined ? null : new Date(value).toISOString();
const asDecimal = (value) =>
  value === null || value === undefined ? null : String(value);

const snapshotBuilders = Object.freeze({
  [AUDIT_ENTITY_TYPE.CLIENT]: (client) => ({
    id: asId(client.id),
    name: client.name,
    phone: client.phone,
    email: client.email ?? null,
    deletedAt: asDate(client.deletedAt),
    deletedByUserId: asId(client.deletedByUserId),
    deleteReason: client.deleteReason ?? null,
  }),
  [AUDIT_ENTITY_TYPE.BIKE]: (bike) => ({
    id: asId(bike.id),
    plate: bike.plate,
    brand: bike.brand,
    model: bike.model,
    cylinder: bike.cylinder,
    clientId: asId(bike.clientId),
    deletedAt: asDate(bike.deletedAt),
    deletedByUserId: asId(bike.deletedByUserId),
    deleteReason: bike.deleteReason ?? null,
  }),
  [AUDIT_ENTITY_TYPE.WORK_ORDER]: (workOrder) => ({
    id: asId(workOrder.id),
    bikeId: asId(workOrder.bikeId),
    entryDate: asDate(workOrder.entryDate),
    faultDescription: workOrder.faultDescription,
    status: workOrder.status,
    total: asDecimal(workOrder.total),
    assignedMechanicId: asId(workOrder.assignedMechanicId),
  }),
  [AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM]: (item) => ({
    id: asId(item.id),
    workOrderId: asId(item.workOrderId),
    type: item.type,
    description: item.description,
    count: item.count,
    unitValue: asDecimal(item.unitValue),
    createdByUserId: asId(item.createdByUserId),
  }),
  [AUDIT_ENTITY_TYPE.USER]: (user) => ({
    id: asId(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
  }),
});

const snapshotFields = Object.freeze({
  [AUDIT_ENTITY_TYPE.CLIENT]: new Set([
    'name',
    'phone',
    'email',
    'deletedAt',
    'deletedByUserId',
    'deleteReason',
  ]),
  [AUDIT_ENTITY_TYPE.BIKE]: new Set([
    'plate',
    'brand',
    'model',
    'cylinder',
    'clientId',
    'deletedAt',
    'deletedByUserId',
    'deleteReason',
  ]),
  [AUDIT_ENTITY_TYPE.WORK_ORDER]: new Set([
    'bikeId',
    'entryDate',
    'faultDescription',
    'status',
    'total',
    'assignedMechanicId',
  ]),
  [AUDIT_ENTITY_TYPE.WORK_ORDER_ITEM]: new Set([
    'workOrderId',
    'type',
    'description',
    'count',
    'unitValue',
    'createdByUserId',
  ]),
  [AUDIT_ENTITY_TYPE.USER]: new Set(['name', 'email', 'role', 'active']),
});

const allowedChangedFields = (entityType, values) => {
  if (!Array.isArray(values)) return [];
  const allowed = snapshotFields[entityType];
  return [...new Set(values.filter((value) => allowed?.has(value)))].sort();
};

const allowedIds = (values) => {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map(asId)
        .filter((value) => /^[1-9]\d{0,19}$/.test(value ?? '')),
    ),
  ].sort((left, right) => {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
};

const compact = (metadata) => {
  const entries = Object.entries(metadata).filter(([, value]) => {
    if (value === undefined) return false;
    return !Array.isArray(value) || value.length > 0;
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

export const buildAuditSnapshot = (entityType, resource) => {
  if (resource === null || resource === undefined) return null;
  const builder = snapshotBuilders[entityType];
  if (!builder) throw new TypeError(`Unsupported audit entity type: ${entityType}`);
  return builder(plain(resource));
};

export const sanitizeAuditMetadata = ({ entityType, action, metadata }) => {
  const value = plain(metadata) ?? {};

  switch (action) {
    case AUDIT_ACTION.CREATED:
      if (entityType !== AUDIT_ENTITY_TYPE.CLIENT || value.duplicateOverride !== true) {
        return null;
      }
      return compact({
        duplicateOverride: true,
        matchedFields: Array.isArray(value.matchedFields)
          ? [...new Set(value.matchedFields.filter((field) => ['phone', 'email'].includes(field)))].sort()
          : [],
        candidateIds: allowedIds(value.candidateIds),
      });
    case AUDIT_ACTION.UPDATED: {
      const hasDuplicateOverride =
        entityType === AUDIT_ENTITY_TYPE.CLIENT &&
          value.duplicateOverride === true;
      return compact({
        changedFields: allowedChangedFields(entityType, value.changedFields),
        duplicateOverride: hasDuplicateOverride ? true : undefined,
        matchedFields:
          hasDuplicateOverride && Array.isArray(value.matchedFields)
            ? [
                ...new Set(
                  value.matchedFields.filter((field) =>
                    ['phone', 'email'].includes(field),
                  ),
                ),
              ].sort()
            : [],
        candidateIds: hasDuplicateOverride
          ? allowedIds(value.candidateIds)
          : [],
      });
    }
    case AUDIT_ACTION.OWNER_CHANGED:
      return compact({
        previousClientId: asId(value.previousClientId),
        newClientId: asId(value.newClientId),
      });
    case AUDIT_ACTION.ASSIGNED:
    case AUDIT_ACTION.REASSIGNED:
    case AUDIT_ACTION.UNASSIGNED:
      return compact({
        previousMechanicId: asId(value.previousMechanicId),
        newMechanicId: asId(value.newMechanicId),
      });
    case AUDIT_ACTION.STATUS_CHANGED:
      return compact({
        transitionKind: Object.values(AUDIT_TRANSITION_KIND).includes(
          value.transitionKind,
        )
          ? value.transitionKind
          : undefined,
      });
    case AUDIT_ACTION.REOPENED:
      return compact({
        reopenType: ['WARRANTY', 'SAME_ISSUE'].includes(value.reopenType)
          ? value.reopenType
          : undefined,
      });
    case AUDIT_ACTION.ROLE_CHANGED:
      return compact({
        previousRole: USER_ROLES.includes(value.previousRole)
          ? value.previousRole
          : undefined,
        newRole: USER_ROLES.includes(value.newRole) ? value.newRole : undefined,
      });
    case AUDIT_ACTION.ACTIVATED:
    case AUDIT_ACTION.DEACTIVATED:
      return compact({
        previousActive: typeof value.previousActive === 'boolean'
          ? value.previousActive
          : undefined,
        newActive: typeof value.newActive === 'boolean'
          ? value.newActive
          : undefined,
      });
    default:
      return null;
  }
};
