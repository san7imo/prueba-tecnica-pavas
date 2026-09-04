export const WORK_ORDER_STATUS = Object.freeze({
  RECEIVED: 'RECIBIDA',
  DIAGNOSIS: 'DIAGNOSTICO',
  IN_PROGRESS: 'EN_PROCESO',
  READY: 'LISTA',
  DELIVERED: 'ENTREGADA',
  CANCELLED: 'CANCELADA',
});

export const WORK_ORDER_STATUSES = Object.freeze(
  Object.values(WORK_ORDER_STATUS),
);

export const OPEN_WORK_ORDER_STATUSES = Object.freeze([
  WORK_ORDER_STATUS.RECEIVED,
  WORK_ORDER_STATUS.DIAGNOSIS,
  WORK_ORDER_STATUS.IN_PROGRESS,
  WORK_ORDER_STATUS.READY,
]);

export const WORK_ORDER_SCOPE = Object.freeze({
  ALL: 'all',
  MINE: 'mine',
  UNASSIGNED: 'unassigned',
});

export const WORK_ORDER_SCOPES = Object.freeze(
  Object.values(WORK_ORDER_SCOPE),
);

export const WORK_ORDER_ITEM_TYPE = Object.freeze({
  LABOR: 'MANO_OBRA',
  PART: 'REPUESTO',
});

export const WORK_ORDER_ITEM_TYPES = Object.freeze(
  Object.values(WORK_ORDER_ITEM_TYPE),
);
