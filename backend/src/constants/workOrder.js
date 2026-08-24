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

export const WORK_ORDER_ITEM_TYPE = Object.freeze({
  LABOR: 'MANO_OBRA',
  PART: 'REPUESTO',
});

export const WORK_ORDER_ITEM_TYPES = Object.freeze(
  Object.values(WORK_ORDER_ITEM_TYPE),
);

