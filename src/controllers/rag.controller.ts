import type { RequestHandler } from 'express';
import { answerResumeRagQuestion } from '../services/rag/rag-answer.service.js';
import { buildResumeRagIndex, getResumeRagStatus } from '../services/rag/rag-index.service.js';

interface BuildRagIndexRequestBody {
  forceRebuild?: boolean;
}

interface AskRagQuestionRequestBody {
  question?: string;
  forceRebuild?: boolean;
}

export const getRagStatusController: RequestHandler = async (_request, response, next) => {
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

export const buildRagIndexController: RequestHandler<
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

export const askRagQuestionController: RequestHandler<
  Record<string, never>,
  unknown,
  AskRagQuestionRequestBody
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
