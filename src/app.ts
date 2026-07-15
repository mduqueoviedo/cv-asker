import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_request, response) => {
    response.json({
      name: 'CV Asker',
      status: 'running',
      apiBasePath: '/api',
    });
  });

  app.use('/api', apiRouter);

  app.use(
    (error: Error, _request: Request, response: Response, _next: NextFunction) => {
      console.error('[Server Error]:', error.message);
      response.status(500).json({
        success: false,
        error: error.message,
      });
    }
  );

  return app;
}
