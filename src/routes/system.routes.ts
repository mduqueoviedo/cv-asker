import { Router } from 'express';
import { runAiConnectivityCheck } from '../controllers/ai.controller.js';
import { getHealthStatus } from '../controllers/health.controller.js';

const systemRouter = Router();

systemRouter.get('/health', getHealthStatus);
systemRouter.get('/test-ai', runAiConnectivityCheck);

export { systemRouter };
