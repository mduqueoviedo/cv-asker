import { Router } from 'express';
import { ragRouter } from './rag.routes.js';
import { resumeRouter } from './resume.routes.js';

const apiRouter = Router();

apiRouter.use('/resumes', resumeRouter);
apiRouter.use('/rag', ragRouter);

export { apiRouter };
