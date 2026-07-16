import { Router, type RequestHandler } from 'express';
import { answerResumeRagQuestion } from '../modules/chat/services/chat-answer.service.js';
import {
  generateResumeDataset,
  getResumeDatasetStorageSnapshot,
} from '../modules/cv-generation/services/resume-generator.service.js';
import type {
  ResumeDocumentLanguageSelection,
  ResumeGenerationMode,
  ResumeTemplateSelection,
} from '../modules/cv-generation/types/resume.js';
import {
  buildResumeRagIndex,
  getResumeRagStatus,
} from '../modules/cv-ingestion/services/cv-ingestion-index.service.js';

const apiRouter = Router();
const legacyRagRouter = Router();

interface BuildRagIndexRequestBody {
  forceRebuild?: boolean;
}

interface AskChatQuestionRequestBody {
  question?: string;
  forceRebuild?: boolean;
}

interface GenerateResumeRequestBody {
  count?: number;
  mode?: ResumeGenerationMode;
  cleanOutput?: boolean;
  language?: ResumeDocumentLanguageSelection;
  llmModel?: string;
  llmModels?: string[];
  template?: ResumeTemplateSelection;
}

const getResumeDatasetStatusHandler: RequestHandler = async (
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

const generateResumeDatasetHandler: RequestHandler<
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

const getCvIngestionStatusHandler: RequestHandler = async (
  _request,
  response,
  next
) => {
  try {
    const status = await getResumeRagStatus();
    response.json({
      success: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
};

const buildCvIngestionIndexHandler: RequestHandler<
  Record<string, never>,
  unknown,
  BuildRagIndexRequestBody
> = async (request, response, next) => {
  try {
    const index = await buildResumeRagIndex({
      forceRebuild: request.body?.forceRebuild,
    });

    response.status(201).json({
      success: true,
      index,
    });
  } catch (error) {
    next(error);
  }
};

const askChatQuestionHandler: RequestHandler<
  Record<string, never>,
  unknown,
  AskChatQuestionRequestBody
> = async (request, response, next) => {
  try {
    const question = request.body?.question?.trim();

    if (!question) {
      response.status(400).json({
        success: false,
        error: 'A non-empty question is required.',
      });
      return;
    }

    const result = await answerResumeRagQuestion(question, {
      forceRebuild: request.body?.forceRebuild,
    });

    response.json({
      success: true,
      result,
    });
  } catch (error) {
    next(error);
  }
};

apiRouter.get('/resumes', getResumeDatasetStatusHandler);
apiRouter.post('/resumes/generate', generateResumeDatasetHandler);
apiRouter.get('/ingestion', getCvIngestionStatusHandler);
apiRouter.get('/ingestion/status', getCvIngestionStatusHandler);
apiRouter.post('/ingestion/index', buildCvIngestionIndexHandler);
apiRouter.post('/chat/ask', askChatQuestionHandler);

legacyRagRouter.get('/', getCvIngestionStatusHandler);
legacyRagRouter.get('/status', getCvIngestionStatusHandler);
legacyRagRouter.post('/index', buildCvIngestionIndexHandler);
legacyRagRouter.post('/ask', askChatQuestionHandler);

apiRouter.use('/rag', legacyRagRouter);

export { apiRouter };
