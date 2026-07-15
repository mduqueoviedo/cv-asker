export type OpenRouterRole = 'system' | 'user' | 'assistant';

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

export interface OpenRouterMessageContentPart {
  type?: string;
  text?: string;
}

export type OpenRouterResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    };

export interface OpenRouterPlugin {
  id: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface OpenRouterProviderPreferences {
  require_parameters?: boolean;
  [key: string]: unknown;
}

export interface OpenRouterChatCompletionResponse {
  choices?: Array<{
    text?: string;
    message?: {
      content?: string | OpenRouterMessageContentPart[];
      reasoning?: string;
      refusal?: string;
    };
    finish_reason?: string;
  }>;
}
