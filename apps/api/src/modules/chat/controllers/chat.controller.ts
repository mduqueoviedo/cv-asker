import type { RequestHandler } from 'express';
import { answerResumeRagQuestion } from '../services/chat-answer.service.js';

interface AskChatQuestionRequestBody {
  question?: string;
  forceRebuild?: boolean;
}

export const askChatQuestionController: RequestHandler<
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
