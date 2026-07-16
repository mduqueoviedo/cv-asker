import { Router } from 'express';
import {
  askRagQuestionController,
  buildRagIndexController,
  getRagStatusController,
} from '../controllers/rag.controller.js';

const ragRouter = Router();

ragRouter.get('/', getRagStatusController);
ragRouter.get('/status', getRagStatusController);
ragRouter.post('/index', buildRagIndexController);
ragRouter.post('/ask', askRagQuestionController);

export { ragRouter };
