export interface GeminiInlineImage {
  data?: string;
  mime_type?: string;
  mimeType?: string;
  type?: string;
}

export interface GeminiInteractionsResponse {
  output_image?: GeminiInlineImage;
  [key: string]: unknown;
}
