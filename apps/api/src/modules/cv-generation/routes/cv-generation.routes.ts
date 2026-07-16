import { Router } from 'express';
import {
  generateResumeDatasetController,
  getResumeDatasetStatusController,
} from '../controllers/resume-dataset.controller.js';

const cvGenerationRouter = Router();

cvGenerationRouter.get('/', getResumeDatasetStatusController);
cvGenerationRouter.post('/generate', generateResumeDatasetController);

export { cvGenerationRouter };
