import { Router } from 'express';

import {
  getAuditEvent,
  listAuditEvents,
} from '../controllers/auditController.js';
import {
  validateAuditEventId,
  validateAuditEventList,
} from '../validators/auditValidators.js';

export const auditRouter = Router();

auditRouter.get('/', validateAuditEventList, listAuditEvents);
auditRouter.get('/:id', validateAuditEventId, getAuditEvent);
