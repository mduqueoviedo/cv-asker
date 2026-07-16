import { Router } from 'express';
import {
  buildCvIngestionIndexController,
  getCvIngestionStatusController,
} from '../modules/cv-ingestion/controllers/cv-ingestion.controller.js';
import { cvIngestionRouter } from '../modules/cv-ingestion/routes/cv-ingestion.routes.js';
import { askChatQuestionController } from '../modules/chat/controllers/chat.controller.js';
import { chatRouter } from '../modules/chat/routes/chat.routes.js';
import { cvGenerationRouter } from '../modules/cv-generation/routes/cv-generation.routes.js';

const apiRouter = Router();
const legacyRagRouter = Router();

apiRouter.use('/resumes', cvGenerationRouter);
apiRouter.use('/ingestion', cvIngestionRouter);
apiRouter.use('/chat', chatRouter);

legacyRagRouter.get('/', getCvIngestionStatusController);
legacyRagRouter.get('/status', getCvIngestionStatusController);
legacyRagRouter.post('/index', buildCvIngestionIndexController);
legacyRagRouter.post('/ask', askChatQuestionController);

apiRouter.use('/rag', legacyRagRouter);

export { apiRouter };
