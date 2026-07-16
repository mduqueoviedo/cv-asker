import { Router } from 'express';
import { askChatQuestionController } from '../controllers/chat.controller.js';

const chatRouter = Router();

chatRouter.post('/ask', askChatQuestionController);

export { chatRouter };
