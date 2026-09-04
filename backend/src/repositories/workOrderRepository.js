import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';
import { OPEN_WORK_ORDER_STATUSES } from '../constants/workOrder.js';

const WORK_ORDER_ATTRIBUTES = [
  'id',
  'bikeId',
  'entryDate',
  'faultDescription',
  'status',
  'total',
  'assignedMechanicId',
];
const BIKE_ATTRIBUTES = ['id', 'plate', 'brand', 'model', 'cylinder', 'clientId'];
const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];
const MECHANIC_ATTRIBUTES = ['id', 'name', 'email', 'role', 'active'];
const ITEM_ATTRIBUTES = [
  'id',
  'workOrderId',
  'type',
  'description',
  'count',
  'unitValue',
];

const bikeInclude = (plate) => ({
  association: 'bike',
  attributes: BIKE_ATTRIBUTES,
  required: true,
  where: plate ? { plate: { [Op.like]: `%${plate}%` } } : undefined,
  include: {
    association: 'client',
    attributes: CLIENT_ATTRIBUTES,
    required: true,
  },
});

const assignedMechanicInclude = {
  association: 'assignedMechanic',
  attributes: MECHANIC_ATTRIBUTES,
  required: false,
};

export const workOrderRepository = {
  create(data, transaction) {
    return models.WorkOrder.create(data, {
      fields: [
        'bikeId',
        'entryDate',
        'faultDescription',
        'status',
        'total',
        'assignedMechanicId',
      ],
      transaction,
    });
  },

  findIdentityById(id, transaction) {
    return models.WorkOrder.findByPk(id, {
      attributes: ['id', 'bikeId', 'assignedMechanicId'],
      transaction,
    });
  },

  findByIdForUpdate(id, transaction) {
    return models.WorkOrder.findByPk(id, {
      attributes: WORK_ORDER_ATTRIBUTES,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  findCurrentOpenByBikeId(bikeId) {
    return models.WorkOrder.findOne({
      attributes: WORK_ORDER_ATTRIBUTES,
      where: {
        bikeId,
        status: { [Op.in]: OPEN_WORK_ORDER_STATUSES },
      },
      order: [
        ['entryDate', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },

  findOpenByBikeIdForUpdate(bikeId, transaction) {
    return models.WorkOrder.findAll({
      attributes: ['id', 'status'],
      where: {
        bikeId,
        status: { [Op.in]: OPEN_WORK_ORDER_STATUSES },
      },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  },

  updateTotal(id, total, transaction) {
    return models.WorkOrder.update(
      { total },
      { where: { id }, fields: ['total'], transaction },
    );
  },

  updateStatus(id, status, transaction) {
    return models.WorkOrder.update(
      { status },
      { where: { id }, fields: ['status'], transaction },
    );
  },

  updateAssignment(workOrder, assignedMechanicId, transaction) {
    return workOrder.update(
      { assignedMechanicId },
      { fields: ['assignedMechanicId'], transaction },
    );
  },

  findById(id) {
    return models.WorkOrder.findByPk(id, {
      attributes: WORK_ORDER_ATTRIBUTES,
      include: [
        bikeInclude(),
        assignedMechanicInclude,
        {
          association: 'items',
          attributes: ITEM_ATTRIBUTES,
          required: false,
        },
      ],
    });
  },

  findPaginated({
    status,
    plate,
    bikeId,
    assignedMechanicId,
    page,
    pageSize,
  }) {
    const where = {};
    if (status) where.status = status;
    if (bikeId) where.bikeId = bikeId;
    if (assignedMechanicId !== undefined) {
      where.assignedMechanicId = assignedMechanicId;
    }
    return models.WorkOrder.findAndCountAll({
      attributes: WORK_ORDER_ATTRIBUTES,
      where,
      include: [bikeInclude(plate), assignedMechanicInclude],
      distinct: true,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ['entryDate', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  },
};
