import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  const publicDirectory = path.join(process.cwd(), 'public');

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/assets', express.static(publicDirectory));

  app.get('/', (_request, response) => {
    response.json({
      name: 'CV Asker',
      status: 'running',
      apiBasePath: '/api',
      chatPath: '/chat',
    });
  });

  app.get('/chat', (_request, response) => {
    response.sendFile(path.join(publicDirectory, 'chat.html'));
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
