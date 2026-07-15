import type { RequestHandler } from 'express';

export const getHealthStatus: RequestHandler = (_request, response) => {
  response.json({
    status: 'ok',
    message: 'Backend server operates within nominal parameters.',
  });
};
