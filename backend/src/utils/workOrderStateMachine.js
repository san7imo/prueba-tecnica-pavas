import { WORK_ORDER_STATUS } from '../constants/workOrder.js';

export const WORK_ORDER_TRANSITIONS = Object.freeze({
  [WORK_ORDER_STATUS.RECEIVED]: Object.freeze([
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.CANCELLED,
  ]),
  [WORK_ORDER_STATUS.DIAGNOSIS]: Object.freeze([
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.CANCELLED,
  ]),
  [WORK_ORDER_STATUS.IN_PROGRESS]: Object.freeze([
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.READY,
    WORK_ORDER_STATUS.CANCELLED,
  ]),
  [WORK_ORDER_STATUS.READY]: Object.freeze([
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.DELIVERED,
    WORK_ORDER_STATUS.CANCELLED,
  ]),
  [WORK_ORDER_STATUS.DELIVERED]: Object.freeze([]),
  [WORK_ORDER_STATUS.CANCELLED]: Object.freeze([]),
});

export const WORK_ORDER_TERMINAL_STATUSES = Object.freeze([
  WORK_ORDER_STATUS.DELIVERED,
  WORK_ORDER_STATUS.CANCELLED,
]);

export const WORK_ORDER_REGRESSION_TRANSITIONS = Object.freeze({
  [WORK_ORDER_STATUS.IN_PROGRESS]: Object.freeze([
    WORK_ORDER_STATUS.DIAGNOSIS,
  ]),
  [WORK_ORDER_STATUS.READY]: Object.freeze([
    WORK_ORDER_STATUS.DIAGNOSIS,
    WORK_ORDER_STATUS.IN_PROGRESS,
  ]),
});

export const canTransition = (fromStatus, toStatus) =>
  WORK_ORDER_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;

export const isRegressionTransition = (fromStatus, toStatus) =>
  WORK_ORDER_REGRESSION_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
