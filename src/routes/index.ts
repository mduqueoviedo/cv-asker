import { Router } from 'express';
import { resumeRouter } from './resume.routes.js';

const apiRouter = Router();

apiRouter.use('/resumes', resumeRouter);

export { apiRouter };
