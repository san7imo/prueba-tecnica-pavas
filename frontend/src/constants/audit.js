export const AUDIT_ENTITY_TYPES = [
  'CLIENT',
  'BIKE',
  'WORK_ORDER',
  'WORK_ORDER_ITEM',
  'USER',
];

export const AUDIT_ENTITY_LABELS = {
  CLIENT: 'Cliente',
  BIKE: 'Motocicleta',
  WORK_ORDER: 'Orden de trabajo',
  WORK_ORDER_ITEM: 'Ítem de orden',
  USER: 'Usuario',
};

export const AUDIT_ACTIONS = [
  'CREATED',
  'UPDATED',
  'SOFT_DELETED',
  'RESTORED',
  'OWNER_CHANGED',
  'ASSIGNED',
  'REASSIGNED',
  'UNASSIGNED',
  'STATUS_CHANGED',
  'REOPENED',
  'CANCELLED',
  'ITEM_ADDED',
  'ITEM_DELETED',
  'ROLE_CHANGED',
  'ACTIVATED',
  'DEACTIVATED',
];

export const AUDIT_ACTION_LABELS = {
  CREATED: 'Creación',
  UPDATED: 'Actualización',
  SOFT_DELETED: 'Eliminación lógica',
  RESTORED: 'Restauración',
  OWNER_CHANGED: 'Cambio de propietario',
  ASSIGNED: 'Asignación',
  REASSIGNED: 'Reasignación',
  UNASSIGNED: 'Retiro de asignación',
  STATUS_CHANGED: 'Cambio de estado',
  REOPENED: 'Reapertura',
  CANCELLED: 'Cancelación',
  ITEM_ADDED: 'Ítem agregado',
  ITEM_DELETED: 'Ítem eliminado',
  ROLE_CHANGED: 'Cambio de rol',
  ACTIVATED: 'Activación',
  DEACTIVATED: 'Desactivación',
};
