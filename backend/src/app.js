import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { securityHeaderOptions } from './config/securityHeaders.js';
import { AppError } from './errors/AppError.js';
import { corsOptions } from './middlewares/corsPolicy.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet(securityHeaderOptions()));
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { AppError };
