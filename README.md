# CV Asker

CV Asker is a local-first full-stack recruitment prototype. The project combines realistic PDF resume generation, a hybrid RAG ingestion pipeline, and a conversational interface that can answer questions about candidate profiles with source attribution.

## Project Status

- The backend is running in Express + TypeScript with ESM and `NodeNext`.
- The first implemented workflow is local resume dataset generation.
- Generated resumes are written to disk as PDFs, alongside JSON metadata derived from the same fresh dataset.
- The RAG ingestion and chat layers are still pending.
- Project requirements are documented in `docs/project-requirements.md`.

## End-to-End Project Map

1. Resume dataset generation: implemented
2. PDF text extraction and normalization: `WIP`
3. Chunking and metadata enrichment: `WIP`
4. Embedding generation and local vector storage: `WIP`
5. Hybrid retrieval with semantic search plus structured filters: `WIP`
6. Answer generation grounded on retrieved CV evidence: `WIP`
7. Frontend chat experience with source attribution: `WIP`

## Backend Capabilities

- Modular route/controller/service structure under `src/`.
- OpenRouter integration through native `fetch`.
- Shared AI HTTP retry layer with timeout and exponential backoff.
- Resume generation service prepared to swap its current static seed provider for a future `faker`-based provider and later AI-assisted text generation.

## Architecture Overview

```text
Resume generation API
  -> build fresh fake candidate dataset
  -> render PDFs and derived JSON metadata
  -> persist artifacts locally
  -> WIP: extract PDF text
  -> WIP: chunk and enrich candidate content
  -> WIP: generate embeddings and store vectors
  -> WIP: run hybrid retrieval for user questions
  -> WIP: answer in chat with source attribution
```

## Local Development

- `pnpm dev`: Run the backend in watch mode.
- `pnpm build`: Compile the TypeScript backend into `dist`.

The backend starts on `http://localhost:3000` by default.

## API Endpoints

- `GET /`: Basic service status payload.
- `GET /api/system/health`: Health check endpoint.
- `GET /api/system/test-ai`: OpenRouter connectivity smoke test.
- `GET /api/resumes`: Inspect whether a generated resume dataset already exists on disk.
- `POST /api/resumes/generate`: Generate a fresh batch of fake resumes as PDFs plus JSON metadata.

## Module Status

- `src/services/resumes/resume-generator.service.ts`: implemented
- `src/services/resumes/resume-pdf.service.ts`: implemented
- `src/services/resumes/resume-seed-data.provider.ts`: implemented
- `src/services/ai/ai-http.service.ts`: implemented
- RAG ingestion services: `WIP`
- Retrieval services: `WIP`
- Chat orchestration: `WIP`
- Frontend application: `WIP`

## Resume Generation Notes

- Each dataset generation run supports `replace` or `append`.
- `replace` is the default mode and clears the previous output before generating a fresh dataset.
- `append` keeps the existing dataset and adds a new batch of resumes without reusing candidate ids or file names.
- The generator enforces the project requirement range of 25-30 resumes per generation run.
- Output is written under `storage/generated-resumes/`.
- JSON metadata is stored only as a derived artifact of the fresh resumes, to support later ingestion steps.
- The current seed data comes from an internal provider layer, so it can be replaced later without rewriting the generator flow.

Example request body:

```json
{
  "count": 28,
  "mode": "replace"
}
```

## Environment Variables

Copy `.env.example` into `.env` and provide a valid OpenRouter API key.

- `PORT`: Local backend port.
- `OPENROUTER_API_KEY`: API key used for chat completions.
- `OPENROUTER_MODEL`: Optional OpenRouter model override.
- `AI_REQUEST_TIMEOUT_MS`: Optional timeout per AI request. Defaults to `20000`.
- `AI_REQUEST_MAX_RETRIES`: Optional retry count for retryable AI API failures. Defaults to `2`.
- `AI_REQUEST_BASE_DELAY_MS`: Optional base delay for exponential backoff. Defaults to `600`.

## Next Planned Steps

- Replace the static resume seed provider with a more realistic data provider such as `faker`.
- Use `faker` locales for multilingual structured data where it improves realism and consistency.
- Add AI-assisted text generation for richer summaries, experience, and profile details.
- Improve resume realism with more varied layouts, styling, and document structure.
- Improve generated text quality so candidate profiles read less templated and more human.
- Integrate an external image generation API to create realistic-but-fake profile photos for resumes.
- Build the PDF ingestion and hybrid RAG pipeline on top of the freshly generated local dataset.
