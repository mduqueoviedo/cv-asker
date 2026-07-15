import { Router } from 'express';
import {
  generateResumes,
  getResumeDatasetStatus,
} from '../controllers/resume.controller.js';

const resumeRouter = Router();

resumeRouter.get('/', getResumeDatasetStatus);
resumeRouter.post('/generate', generateResumes);

export { resumeRouter };
