import { initializeAuditEvent } from './AuditEvent.js';
import { initializeBike } from './Bike.js';
import { initializeClient } from './Client.js';
import { initializeWorkOrder } from './WorkOrder.js';
import { initializeWorkOrderItem } from './WorkOrderItem.js';
import { initializeWorkOrderStatusHistory } from './WorkOrderStatusHistory.js';
import { initializeRefreshToken } from './RefreshToken.js';
import { initializeUser } from './User.js';

export const initializeModels = (sequelize) => {
  const Client = initializeClient(sequelize);
  const Bike = initializeBike(sequelize);
  const WorkOrder = initializeWorkOrder(sequelize);
  const WorkOrderItem = initializeWorkOrderItem(sequelize);
  const WorkOrderStatusHistory = initializeWorkOrderStatusHistory(sequelize);
  const User = initializeUser(sequelize);
  const RefreshToken = initializeRefreshToken(sequelize);
  const AuditEvent = initializeAuditEvent(sequelize);

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

  User.hasMany(Client, {
    as: 'deletedClients',
    foreignKey: {
      name: 'deletedByUserId',
      field: 'deleted_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });
  Client.belongsTo(User, {
    as: 'deletedBy',
    foreignKey: {
      name: 'deletedByUserId',
      field: 'deleted_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });

  User.hasMany(Bike, {
    as: 'deletedBikes',
    foreignKey: {
      name: 'deletedByUserId',
      field: 'deleted_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });
  Bike.belongsTo(User, {
    as: 'deletedBy',
    foreignKey: {
      name: 'deletedByUserId',
      field: 'deleted_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
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

  User.hasMany(WorkOrder, {
    as: 'assignedWorkOrders',
    foreignKey: {
      name: 'assignedMechanicId',
      field: 'assigned_mechanic_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrder.belongsTo(User, {
    as: 'assignedMechanic',
    foreignKey: {
      name: 'assignedMechanicId',
      field: 'assigned_mechanic_id',
      allowNull: true,
    },
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

  User.hasMany(WorkOrderItem, {
    as: 'createdWorkOrderItems',
    foreignKey: {
      name: 'createdByUserId',
      field: 'created_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrderItem.belongsTo(User, {
    as: 'createdBy',
    foreignKey: {
      name: 'createdByUserId',
      field: 'created_by_user_id',
      allowNull: true,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  WorkOrder.hasMany(WorkOrderStatusHistory, {
    as: 'statusHistory',
    foreignKey: {
      name: 'workOrderId',
      field: 'work_order_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrderStatusHistory.belongsTo(WorkOrder, {
    as: 'workOrder',
    foreignKey: {
      name: 'workOrderId',
      field: 'work_order_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  User.hasMany(RefreshToken, {
    as: 'refreshTokens',
    foreignKey: { name: 'userId', field: 'user_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  User.hasMany(WorkOrderStatusHistory, {
    as: 'statusChanges',
    foreignKey: {
      name: 'changedByUserId',
      field: 'changed_by_user_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  WorkOrderStatusHistory.belongsTo(User, {
    as: 'changedBy',
    foreignKey: {
      name: 'changedByUserId',
      field: 'changed_by_user_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RefreshToken.belongsTo(User, {
    as: 'user',
    foreignKey: { name: 'userId', field: 'user_id', allowNull: false },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  RefreshToken.belongsTo(RefreshToken, {
    as: 'replacement',
    foreignKey: { name: 'replacedByTokenId', field: 'replaced_by_token_id', allowNull: true },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  User.hasMany(AuditEvent, {
    as: 'auditEvents',
    foreignKey: {
      name: 'actorUserId',
      field: 'actor_user_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  AuditEvent.belongsTo(User, {
    as: 'actor',
    foreignKey: {
      name: 'actorUserId',
      field: 'actor_user_id',
      allowNull: false,
    },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  return {
    Client,
    Bike,
    WorkOrder,
    WorkOrderItem,
    WorkOrderStatusHistory,
    User,
    RefreshToken,
    AuditEvent,
  };
};
