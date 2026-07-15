import { Router } from 'express';
import { resumeRouter } from './resume.routes.js';
import { systemRouter } from './system.routes.js';

const apiRouter = Router();

apiRouter.use('/system', systemRouter);
apiRouter.use('/resumes', resumeRouter);

export { apiRouter };
