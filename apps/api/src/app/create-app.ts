import { existsSync } from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './api-router.js';
import { chatDistributionDirectory } from '../shared/config/paths.js';

export function createApp() {
  const app = express();
  const chatIndexPath = `${chatDistributionDirectory}/index.html`;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/chat', express.static(chatDistributionDirectory));

  app.get('/', (_request, response) => {
    response.json({
      name: 'CV Asker',
      status: 'running',
      apiBasePath: '/api',
      chatPath: '/chat',
    });
  });

  app.get('/chat', (_request, response) => {
    if (!existsSync(chatIndexPath)) {
      response.status(503).json({
        success: false,
        error: 'Chat UI build not found. Run the chat build before opening /chat.',
      });
      return;
    }

    response.sendFile(chatIndexPath);
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
