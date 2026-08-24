import { createSequelize } from './database.js';
import { initializeModels } from '../models/index.js';

export const sequelize = createSequelize();
export const models = initializeModels(sequelize);
