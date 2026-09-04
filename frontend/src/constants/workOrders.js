export const WORK_ORDER_STATUSES = [
  'RECIBIDA',
  'DIAGNOSTICO',
  'EN_PROCESO',
  'LISTA',
  'ENTREGADA',
  'CANCELADA',
];

export const OPEN_WORK_ORDER_STATUSES = [
  'RECIBIDA',
  'DIAGNOSTICO',
  'EN_PROCESO',
  'LISTA',
];

export const WORK_ORDER_STATUS_LABELS = {
  RECIBIDA: 'Recibida',
  DIAGNOSTICO: 'Diagnóstico',
  EN_PROCESO: 'En proceso',
  LISTA: 'Lista',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export const WORK_ORDER_TRANSITION_ACTION_LABELS = {
  DIAGNOSTICO: 'Iniciar diagnóstico',
  EN_PROCESO: 'Iniciar reparación',
  LISTA: 'Marcar como lista',
  ENTREGADA: 'Entregar orden',
  CANCELADA: 'Cancelar orden',
};

export const WORK_ORDER_REGRESSION_ACTION_LABELS = {
  'EN_PROCESO:DIAGNOSTICO': 'Volver a diagnóstico',
  'LISTA:DIAGNOSTICO': 'Volver a diagnóstico',
  'LISTA:EN_PROCESO': 'Volver a reparación',
};

export const WORK_ORDER_TRANSITIONS = {
  RECIBIDA: ['DIAGNOSTICO', 'CANCELADA'],
  DIAGNOSTICO: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['DIAGNOSTICO', 'LISTA', 'CANCELADA'],
  LISTA: ['DIAGNOSTICO', 'EN_PROCESO', 'ENTREGADA', 'CANCELADA'],
  ENTREGADA: [],
  CANCELADA: [],
};

export const isWorkOrderRegression = (fromStatus, toStatus) =>
  Object.prototype.hasOwnProperty.call(
    WORK_ORDER_REGRESSION_ACTION_LABELS,
    `${fromStatus}:${toStatus}`,
  );

export const getWorkOrderTransitionActionLabel = (fromStatus, toStatus) =>
  WORK_ORDER_REGRESSION_ACTION_LABELS[`${fromStatus}:${toStatus}`] ??
  WORK_ORDER_TRANSITION_ACTION_LABELS[toStatus];

export const WORK_ORDER_ITEM_TYPES = [
  { value: 'MANO_OBRA', label: 'Mano de obra' },
  { value: 'REPUESTO', label: 'Repuesto' },
];
