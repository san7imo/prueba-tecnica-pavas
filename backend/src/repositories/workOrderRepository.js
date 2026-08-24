import { Op } from 'sequelize';

import { models } from '../config/databaseContext.js';

const WORK_ORDER_ATTRIBUTES = [
  'id',
  'bikeId',
  'entryDate',
  'faultDescription',
  'status',
  'total',
];
const BIKE_ATTRIBUTES = ['id', 'plate', 'brand', 'model', 'cylinder', 'clientId'];
const CLIENT_ATTRIBUTES = ['id', 'name', 'phone', 'email'];
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

export const workOrderRepository = {
  create(data) {
    return models.WorkOrder.create(data, {
      fields: ['bikeId', 'entryDate', 'faultDescription', 'status', 'total'],
    });
  },

  findById(id) {
    return models.WorkOrder.findByPk(id, {
      attributes: WORK_ORDER_ATTRIBUTES,
      include: [
        bikeInclude(),
        {
          association: 'items',
          attributes: ITEM_ATTRIBUTES,
          required: false,
        },
      ],
    });
  },

  findPaginated({ status, plate, page, pageSize }) {
    return models.WorkOrder.findAndCountAll({
      attributes: WORK_ORDER_ATTRIBUTES,
      where: status ? { status } : undefined,
      include: [bikeInclude(plate)],
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
