import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

import { env } from '../src/config/env.js';
import { models, sequelize } from '../src/config/databaseContext.js';
import { USER_ROLE } from '../src/constants/auth.js';
import {
  WORK_ORDER_ITEM_TYPE,
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUSES,
} from '../src/constants/workOrder.js';
import { canTransition } from '../src/utils/workOrderStateMachine.js';

export const DEMO_EMAIL_DOMAIN = 'demo.pavas.test';
export const DEMO_MECHANIC_PASSWORD = 'DemoMechanic-2026!';

export const DEMO_EXPECTED_COUNTS = Object.freeze({
  users: 3,
  clients: 20,
  bikes: 30,
  workOrders: 96,
  items: 192,
  history: 296,
});

const DEMO_CREATED_AT = new Date('2026-01-05T13:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const ORDER_INTERVAL_MS = 8 * HOUR_MS;

const CLIENT_NAMES = [
  'Andrea Beltrán',
  'Carlos Andrés Rojas',
  'Diana Marcela Gómez',
  'Felipe Cárdenas',
  'Gabriela Torres',
  'Hernán Darío López',
  'Isabel Cristina Ruiz',
  'Jorge Iván Mendoza',
  'Karen Julieth Castro',
  'Luis Fernando Ortiz',
  'María Camila Vargas',
  'Nicolás Restrepo',
  'Paola Andrea Silva',
  'Ricardo Villamil',
  'Sandra Milena Pérez',
  'Tomás Alejandro León',
  'Valentina Ramírez',
  'William Esteban Díaz',
  'Ximena Alejandra Mora',
  'Yulieth Carolina Sánchez',
];

const BIKE_CATALOG = [
  ['Yamaha', 'FZ 2.0', '149 cc'],
  ['Yamaha', 'XTZ 125', '124 cc'],
  ['Honda', 'CB 160F', '162 cc'],
  ['Honda', 'XR 150L', '149 cc'],
  ['Suzuki', 'Gixxer 150', '155 cc'],
  ['Suzuki', 'GN 125', '125 cc'],
  ['Bajaj', 'Pulsar NS 200', '199 cc'],
  ['Bajaj', 'Boxer CT 100', '102 cc'],
  ['AKT', 'NKD 125', '125 cc'],
  ['TVS', 'Apache RTR 200', '197 cc'],
  ['KTM', 'Duke 200', '200 cc'],
  ['Victory', 'One ST 100', '100 cc'],
];

const FAULTS = [
  'La motocicleta presenta dificultad de encendido en frío.',
  'Se percibe vibración excesiva al superar 60 km/h.',
  'El freno delantero perdió presión durante el recorrido.',
  'La cadena genera ruido y requiere ajuste frecuente.',
  'El motor pierde potencia en pendientes pronunciadas.',
  'Se escucha golpeteo metálico en la parte alta del motor.',
  'La luz principal funciona de manera intermitente.',
  'Hay fuga leve de aceite cerca de la tapa de válvulas.',
  'La batería se descarga después de varios días sin uso.',
  'La dirección se siente inestable al tomar curvas.',
  'Se requiere mantenimiento preventivo general.',
  'El embrague patina al acelerar con carga.',
];

const LABOR_CATALOG = [
  ['Diagnóstico general y prueba de ruta', 45000],
  ['Mantenimiento preventivo y lubricación', 85000],
  ['Limpieza y sincronización de carburador', 70000],
  ['Ajuste de válvulas', 95000],
  ['Revisión del sistema eléctrico', 65000],
  ['Cambio y purga de líquido de frenos', 55000],
  ['Ajuste de kit de arrastre', 40000],
  ['Desmontaje y revisión de embrague', 120000],
];

const PART_CATALOG = [
  ['Aceite semisintético 10W-40', 38000],
  ['Filtro de aceite', 26000],
  ['Bujía de encendido', 22000],
  ['Pastillas de freno delanteras', 68000],
  ['Guaya de embrague', 42000],
  ['Bombillo LED principal', 52000],
  ['Filtro de aire', 35000],
  ['Rodamientos de dirección', 98000],
];

const MECHANICS = [
  ['Juan David Herrera', 'mecanico.demo.01'],
  ['Laura Sofía Méndez', 'mecanico.demo.02'],
  ['Mateo Alejandro Parra', 'mecanico.demo.03'],
];

const FORWARD_PATH = [
  WORK_ORDER_STATUS.RECEIVED,
  WORK_ORDER_STATUS.DIAGNOSIS,
  WORK_ORDER_STATUS.IN_PROGRESS,
  WORK_ORDER_STATUS.READY,
  WORK_ORDER_STATUS.DELIVERED,
];

const TRANSITION_NOTES = Object.freeze({
  [WORK_ORDER_STATUS.DIAGNOSIS]: 'Motocicleta recibida para diagnóstico técnico.',
  [WORK_ORDER_STATUS.IN_PROGRESS]: 'Diagnóstico aprobado; inicia intervención del taller.',
  [WORK_ORDER_STATUS.READY]: 'Trabajo terminado y prueba de ruta satisfactoria.',
  [WORK_ORDER_STATUS.DELIVERED]: 'Motocicleta entregada al cliente.',
  [WORK_ORDER_STATUS.CANCELLED]: 'Servicio cancelado por solicitud del cliente.',
});

const addMilliseconds = (date, milliseconds) => new Date(date.getTime() + milliseconds);

const money = (value) => `${value}.00`;

const buildClients = () =>
  CLIENT_NAMES.map((name, index) => {
    const sequence = String(index + 1).padStart(2, '0');
    const timestamp = addMilliseconds(DEMO_CREATED_AT, index * 60_000);
    return {
      name,
      phone: `30055501${sequence}`,
      email: `cliente.demo.${sequence}@${DEMO_EMAIL_DOMAIN}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

const buildBikes = (clients) =>
  Array.from({ length: DEMO_EXPECTED_COUNTS.bikes }, (_, index) => {
    const [brand, model, cylinder] = BIKE_CATALOG[index % BIKE_CATALOG.length];
    const timestamp = addMilliseconds(DEMO_CREATED_AT, (index + 30) * 60_000);
    return {
      plate: `DMO${String(index + 1).padStart(3, '0')}`,
      brand,
      model,
      cylinder,
      clientId: clients[index % clients.length].id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

const pathForStatus = (status, orderIndex) => {
  if (status !== WORK_ORDER_STATUS.CANCELLED) {
    return FORWARD_PATH.slice(0, FORWARD_PATH.indexOf(status) + 1);
  }

  const cancellationDepth = Math.floor(orderIndex / WORK_ORDER_STATUSES.length) % 4;
  return [
    ...FORWARD_PATH.slice(0, cancellationDepth + 1),
    WORK_ORDER_STATUS.CANCELLED,
  ];
};

const buildOrderPlans = () =>
  Array.from({ length: DEMO_EXPECTED_COUNTS.workOrders }, (_, index) => {
    const status = WORK_ORDER_STATUSES[index % WORK_ORDER_STATUSES.length];
    const entryDate = addMilliseconds(DEMO_CREATED_AT, index * ORDER_INTERVAL_MS);
    const [laborDescription, laborUnitValue] = LABOR_CATALOG[index % LABOR_CATALOG.length];
    const [partDescription, partUnitValue] = PART_CATALOG[index % PART_CATALOG.length];
    const laborCount = index % 2 === 0 ? 1 : 2;
    const partCount = index % 3 === 0 ? 2 : 1;
    const path = pathForStatus(status, index);

    return {
      entryDate,
      status,
      path,
      faultDescription: `[DEMO] ${FAULTS[index % FAULTS.length]}`,
      total: laborCount * laborUnitValue + partCount * partUnitValue,
      items: [
        {
          type: WORK_ORDER_ITEM_TYPE.LABOR,
          description: laborDescription,
          count: laborCount,
          unitValue: laborUnitValue,
        },
        {
          type: WORK_ORDER_ITEM_TYPE.PART,
          description: partDescription,
          count: partCount,
          unitValue: partUnitValue,
        },
      ],
    };
  });

const findDemoMarker = async (transaction) => {
  const emailPattern = `%@${DEMO_EMAIL_DOMAIN}`;
  const demoUser = await models.User.findOne({
    where: { email: { [Op.like]: emailPattern } },
    attributes: ['id'],
    transaction,
  });
  if (demoUser) return demoUser;

  return models.Client.findOne({
    where: { email: { [Op.like]: emailPattern } },
    attributes: ['id'],
    transaction,
  });
};

const createMechanics = async (transaction) => {
  const passwordHashes = await Promise.all(
    MECHANICS.map(() => bcrypt.hash(DEMO_MECHANIC_PASSWORD, env.auth.bcryptRounds)),
  );

  return models.User.bulkCreate(
    MECHANICS.map(([name, emailPrefix], index) => ({
      name,
      email: `${emailPrefix}@${DEMO_EMAIL_DOMAIN}`,
      passwordHash: passwordHashes[index],
      role: USER_ROLE.MECHANIC,
      active: true,
      createdAt: addMilliseconds(DEMO_CREATED_AT, (index + 1) * 60_000),
      updatedAt: addMilliseconds(DEMO_CREATED_AT, (index + 1) * 60_000),
    })),
    { validate: true, transaction },
  );
};

const createOrders = async ({ bikes, admin, mechanics, transaction }) => {
  const plans = buildOrderPlans();
  const orders = await models.WorkOrder.bulkCreate(
    plans.map((plan, index) => ({
      bikeId: bikes[index % bikes.length].id,
      entryDate: plan.entryDate,
      faultDescription: plan.faultDescription,
      status: plan.status,
      total: money(plan.total),
      createdAt: plan.entryDate,
      updatedAt: addMilliseconds(plan.entryDate, (plan.path.length - 1) * HOUR_MS),
    })),
    { validate: true, transaction },
  );

  const itemRows = [];
  const historyRows = [];
  const statusDistribution = Object.fromEntries(
    WORK_ORDER_STATUSES.map((status) => [status, 0]),
  );

  plans.forEach((plan, orderIndex) => {
    const order = orders[orderIndex];
    statusDistribution[plan.status] += 1;

    plan.items.forEach((item, itemIndex) => {
      const timestamp = addMilliseconds(plan.entryDate, (itemIndex + 1) * 15 * 60_000);
      itemRows.push({
        workOrderId: order.id,
        type: item.type,
        description: item.description,
        count: money(item.count),
        unitValue: money(item.unitValue),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });

    let fromStatus = null;
    plan.path.forEach((toStatus, pathIndex) => {
      if (fromStatus !== null && !canTransition(fromStatus, toStatus)) {
        throw new Error(`Invalid demo history transition: ${fromStatus} -> ${toStatus}.`);
      }

      const isAdminTransition = [
        WORK_ORDER_STATUS.DELIVERED,
        WORK_ORDER_STATUS.CANCELLED,
      ].includes(toStatus);
      const changedByUserId =
        pathIndex === 0 || isAdminTransition
          ? admin.id
          : mechanics[(orderIndex + pathIndex) % mechanics.length].id;

      historyRows.push({
        workOrderId: order.id,
        fromStatus,
        toStatus,
        note: pathIndex === 0 ? null : TRANSITION_NOTES[toStatus],
        changedByUserId,
        createdAt: addMilliseconds(plan.entryDate, pathIndex * HOUR_MS),
      });
      fromStatus = toStatus;
    });
  });

  await models.WorkOrderItem.bulkCreate(itemRows, { validate: true, transaction });
  await models.WorkOrderStatusHistory.bulkCreate(historyRows, {
    validate: true,
    transaction,
  });

  return { orders, itemRows, historyRows, statusDistribution };
};

export const seedDemoData = async ({ nodeEnv = env.nodeEnv } = {}) => {
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error('Demo data seed is allowed only in development or test environments.');
  }

  return sequelize.transaction(async (transaction) => {
    if (await findDemoMarker(transaction)) {
      return { created: false, counts: null, statusDistribution: null };
    }

    const admin = await models.User.findOne({
      where: { role: USER_ROLE.ADMIN, active: true },
      attributes: ['id'],
      order: [['id', 'ASC']],
      transaction,
    });
    if (!admin) {
      throw new Error('An active ADMIN is required. Run npm run db:seed:admin first.');
    }

    const mechanics = await createMechanics(transaction);
    const clients = await models.Client.bulkCreate(buildClients(), {
      validate: true,
      transaction,
    });
    const bikes = await models.Bike.bulkCreate(buildBikes(clients), {
      validate: true,
      transaction,
    });
    const { orders, itemRows, historyRows, statusDistribution } = await createOrders({
      bikes,
      admin,
      mechanics,
      transaction,
    });

    const counts = {
      users: mechanics.length,
      clients: clients.length,
      bikes: bikes.length,
      workOrders: orders.length,
      items: itemRows.length,
      history: historyRows.length,
    };
    if (JSON.stringify(counts) !== JSON.stringify(DEMO_EXPECTED_COUNTS)) {
      throw new Error('Demo data count verification failed.');
    }

    return { created: true, counts, statusDistribution };
  });
};
