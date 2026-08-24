import { initializeBike } from './Bike.js';
import { initializeClient } from './Client.js';
import { initializeWorkOrder } from './WorkOrder.js';
import { initializeWorkOrderItem } from './WorkOrderItem.js';

export const initializeModels = (sequelize) => {
  const Client = initializeClient(sequelize);
  const Bike = initializeBike(sequelize);
  const WorkOrder = initializeWorkOrder(sequelize);
  const WorkOrderItem = initializeWorkOrderItem(sequelize);

  Client.hasMany(Bike, {
    as: 'bikes',
    foreignKey: { name: 'clientId', field: 'client_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  Bike.belongsTo(Client, {
    as: 'client',
    foreignKey: { name: 'clientId', field: 'client_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Bike.hasMany(WorkOrder, {
    as: 'workOrders',
    foreignKey: { name: 'bikeId', field: 'bike_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrder.belongsTo(Bike, {
    as: 'bike',
    foreignKey: { name: 'bikeId', field: 'bike_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  WorkOrder.hasMany(WorkOrderItem, {
    as: 'items',
    foreignKey: {
      name: 'workOrderId',
      field: 'work_order_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrderItem.belongsTo(WorkOrder, {
    as: 'workOrder',
    foreignKey: {
      name: 'workOrderId',
      field: 'work_order_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  return { Client, Bike, WorkOrder, WorkOrderItem };
};

