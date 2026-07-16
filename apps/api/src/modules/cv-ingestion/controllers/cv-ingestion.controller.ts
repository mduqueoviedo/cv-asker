import type { RequestHandler } from 'express';
import {
  buildResumeRagIndex,
  getResumeRagStatus,
} from '../services/cv-ingestion-index.service.js';

interface BuildRagIndexRequestBody {
  forceRebuild?: boolean;
}

export const getCvIngestionStatusController: RequestHandler = async (
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

export const buildCvIngestionIndexController: RequestHandler<
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
