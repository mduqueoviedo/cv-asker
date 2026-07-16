import { Router } from 'express';
import {
  buildCvIngestionIndexController,
  getCvIngestionStatusController,
} from '../controllers/cv-ingestion.controller.js';

const cvIngestionRouter = Router();

cvIngestionRouter.get('/', getCvIngestionStatusController);
cvIngestionRouter.get('/status', getCvIngestionStatusController);
cvIngestionRouter.post('/index', buildCvIngestionIndexController);

export { cvIngestionRouter };
