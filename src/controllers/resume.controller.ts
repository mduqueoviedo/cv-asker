import type { RequestHandler } from 'express';
import {
  generateResumeDataset,
  getResumeDatasetStorageSnapshot,
} from '../services/resumes/resume-generator.service.js';
import type { ResumeGenerationMode } from '../types/resume.js';

interface GenerateResumeRequestBody {
  count?: number;
  mode?: ResumeGenerationMode;
  cleanOutput?: boolean;
}

export const generateResumes: RequestHandler<
  Record<string, never>,
  unknown,
  GenerateResumeRequestBody
> = async (request, response, next) => {
  try {
    const manifest = await generateResumeDataset({
      count: request.body?.count,
      mode: request.body?.mode,
      cleanOutput: request.body?.cleanOutput,
    });

    response.status(201).json({
      success: true,
      dataset: manifest,
    });
  } catch (error) {
    next(error);
  }
};

export const getResumeDatasetStatus: RequestHandler = async (_request, response, next) => {
  try {
    const snapshot = await getResumeDatasetStorageSnapshot();

    if (!snapshot) {
      response.status(404).json({
        success: false,
        error: 'No generated resume dataset was found on disk.',
      });
      return;
    }

    response.json({
      success: true,
      ...snapshot,
    });
  } catch (error) {
    next(error);
  }
};
