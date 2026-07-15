import type { RequestHandler } from 'express';
import { generateTextCompletion } from '../services/ai/ai.service.js';

export const runAiConnectivityCheck: RequestHandler = async (_request, response, next) => {
  try {
    const generatedResponse = await generateTextCompletion({
      prompt: 'Provide a brief, clever greeting in Spanish.',
      systemInstruction: 'Act as a highly articulate, witty AI companion.',
    });

    response.json({
      success: true,
      response: generatedResponse,
    });
  } catch (error) {
    next(error);
  }
};
