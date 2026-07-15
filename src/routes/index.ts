import { Router } from 'express';
import { systemRouter } from './system.routes.js';

const apiRouter = Router();

apiRouter.use('/system', systemRouter);

export { apiRouter };
