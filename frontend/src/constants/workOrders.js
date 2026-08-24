export const WORK_ORDER_STATUSES = [
  'RECIBIDA',
  'DIAGNOSTICO',
  'EN_PROCESO',
  'LISTA',
  'ENTREGADA',
  'CANCELADA',
];

export const WORK_ORDER_STATUS_LABELS = {
  RECIBIDA: 'Recibida',
  DIAGNOSTICO: 'Diagnóstico',
  EN_PROCESO: 'En proceso',
  LISTA: 'Lista',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export const WORK_ORDER_TRANSITIONS = {
  RECIBIDA: ['DIAGNOSTICO', 'CANCELADA'],
  DIAGNOSTICO: ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['LISTA', 'CANCELADA'],
  LISTA: ['ENTREGADA', 'CANCELADA'],
  ENTREGADA: [],
  CANCELADA: [],
};

export const WORK_ORDER_ITEM_TYPES = [
  { value: 'MANO_OBRA', label: 'Mano de obra' },
  { value: 'REPUESTO', label: 'Repuesto' },
];
