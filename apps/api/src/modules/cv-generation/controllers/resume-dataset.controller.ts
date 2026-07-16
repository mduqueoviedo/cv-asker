import type { RequestHandler } from 'express';
import {
  generateResumeDataset,
  getResumeDatasetStorageSnapshot,
} from '../services/resume-generator.service.js';
import type {
  ResumeDocumentLanguageSelection,
  ResumeGenerationMode,
  ResumeTemplateSelection,
} from '../types/resume.js';

interface GenerateResumeRequestBody {
  count?: number;
  mode?: ResumeGenerationMode;
  cleanOutput?: boolean;
  language?: ResumeDocumentLanguageSelection;
  llmModel?: string;
  llmModels?: string[];
  template?: ResumeTemplateSelection;
}

export const generateResumeDatasetController: RequestHandler<
  Record<string, never>,
  unknown,
  GenerateResumeRequestBody
> = async (request, response, next) => {
  try {
    const manifest = await generateResumeDataset({
      count: request.body?.count,
      mode: request.body?.mode,
      cleanOutput: request.body?.cleanOutput,
      language: request.body?.language,
      llmModel: request.body?.llmModel,
      llmModels: request.body?.llmModels,
      template: request.body?.template,
    });

    response.status(201).json({
      success: true,
      dataset: manifest,
    });
  } catch (error) {
    next(error);
  }
};

export const getResumeDatasetStatusController: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const snapshot = await getResumeDatasetStorageSnapshot();

    if (!snapshot) {
      response.status(404).json({
        success: false,
        error: 'No generated resume manifest was found on disk.',
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
