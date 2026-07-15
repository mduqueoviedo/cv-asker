# CV Asker

CV Asker is a local-first full-stack recruitment prototype. The project combines realistic resume generation, a hybrid RAG ingestion pipeline, and a conversational interface that can answer questions about candidate profiles with source attribution.

## Project Status

- The backend is running in Express + TypeScript with ESM and `NodeNext`.
- The first implemented workflow is local resume dataset generation.
- Generated resumes are written to disk as PDFs plus JSON metadata derived from the same fresh dataset.
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
- Image generation through native `fetch`, currently backed by Gemini.
- Shared AI HTTP retry layer with timeout and exponential backoff.
- Ordered OpenRouter fallback for lightweight resume-text enrichment.
- Resume generation service now builds the CV structure locally with `faker` and enriches only summary/highlights with the LLM.
- Resume generation now creates a realistic synthetic headshot per candidate before rendering the PDF.
- Resume datasets can be generated in `en` or `es-ES`.

## Architecture Overview

```text
Resume generation API
  -> build fresh fake candidate dataset
  -> render styled resume templates into PDFs and derived JSON metadata
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
- `pnpm generate:resumes`: Delete the previous generated dataset and create a fresh default batch of 25 resumes in `es-ES`.
- `pnpm generate:resumes:en`: Delete the previous generated dataset and create a fresh default batch of 25 resumes in English.
- `pnpm generate:resumes:append`: Append a default batch of 25 resumes in `es-ES` to the current dataset.
- `pnpm smoke:resumes -- --count 25 --language es-ES`: Run a full local resume-generation smoke test without starting the HTTP server.

The backend starts on `http://localhost:3000` by default.

## API Endpoints

- `GET /`: Basic service status payload.
- `GET /api/resumes`: Inspect whether a generated resume dataset already exists on disk.
- `POST /api/resumes/generate`: Generate a fresh batch of fake resumes as PDFs plus JSON metadata.

## Module Status

- `src/services/resumes/resume-generator.service.ts`: implemented
- `src/services/resumes/resume-html.service.ts`: implemented
- `src/services/resumes/resume-faker-data.provider.ts`: implemented
- `src/services/resumes/resume-llm-text.service.ts`: implemented
- `src/services/resumes/resume-photo.service.ts`: implemented
- `src/services/ai/ai-http.service.ts`: implemented
- `src/services/ai/image-generation.service.ts`: implemented
- `src/services/ai/gemini-image.service.ts`: implemented
- RAG ingestion services: `WIP`
- Retrieval services: `WIP`
- Chat orchestration: `WIP`
- Frontend application: `WIP`

## Resume Generation Notes

- Each dataset generation run supports `replace` or `append`.
- `replace` is the default mode and clears the previous output before generating a fresh dataset.
- `append` keeps the existing dataset and adds a new batch of resumes without reusing candidate ids or file names.
- The generator enforces the project requirement range of 25-30 resumes per generation run.
- Personal seed data and the full resume structure come from `faker` plus small local catalogs.
- OpenRouter is used only to enrich the professional summary and highlights, keeping token usage and failure surface low.
- The CV flow uses a generic image-generation layer to create a realistic synthetic profile photo for every candidate.
- Supported document languages are `en` and `es-ES`.
- Resume templates are now modeled explicitly so the renderer can move to HTML-to-PDF later without changing the dataset shape.
- HTML should be treated as a transient render step and cleaned up once its PDF counterpart has been produced.
- The current default template is `aurora-split`.
- Output is written under `storage/generated-resumes/`.
- JSON metadata is stored only as a derived artifact of the fresh resumes, to support later ingestion steps.
- Generated photo binaries are stored under `storage/generated-resumes/photos/`.
- Each generated artifact records the language and the model used for text enrichment, or `local/base-profile` when the local copy is kept.
- When multiple models are configured, the generator tries them in order and keeps valid local copy if all enrichment attempts fail.
- The default photo model is `gemini-3.1-flash-lite-image`.

Example request body:

```json
{
  "count": 28,
  "mode": "replace",
  "language": "es-ES",
  "llmModels": [
    "google/gemini-2.5-flash-lite",
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-20b:free"
  ],
  "template": "aurora-split"
}
```

Example smoke command:

```bash
pnpm smoke:resumes -- --count 25 --mode replace --language es-ES --template aurora-split
```

Example smoke command with explicit multi-model fallback:

```bash
pnpm smoke:resumes -- --count 6 --mode replace --language es-ES --template aurora-split --models google/gemini-2.5-flash-lite,google/gemma-3-27b-it:free,openai/gpt-oss-20b:free
```

Default generation command:

```bash
pnpm generate:resumes
```

This command always runs in `replace` mode, so it removes the previously generated dataset before creating a new one.

Other shortcuts:

```bash
pnpm generate:resumes:en
pnpm generate:resumes:append
```

## Environment Variables

Copy `.env.example` into `.env`. Image-generation credentials are required because each CV now includes a generated profile photo. `OPENROUTER_API_KEY` is still optional and is used only for LLM enrichment.

- `PORT`: Local backend port.
- `IMAGE_GENERATION_PROVIDER`: Image-generation backend selector. Currently supports `gemini`.
- `IMAGE_GENERATION_MODEL`: Model used by the active image-generation backend. Defaults to `gemini-3.1-flash-lite-image`.
- `GEMINI_API_KEY`: API key used by the current Gemini-backed image-generation implementation.
- `OPENROUTER_API_KEY`: API key used for optional resume-text enrichment.
- `OPENROUTER_MODELS`: Optional comma-separated OpenRouter model list used in ordered fallback mode.
- `OPENROUTER_MODEL`: Optional legacy single-model override. Ignored when `OPENROUTER_MODELS` is set.
- `AI_REQUEST_TIMEOUT_MS`: Optional timeout per AI request. Defaults to `20000`.
- `AI_REQUEST_MAX_RETRIES`: Optional retry count for retryable AI API failures. Defaults to `2`.
- `AI_REQUEST_BASE_DELAY_MS`: Optional base delay for exponential backoff. Defaults to `600`.
- `AI_COMPLETION_MAX_TOKENS`: Max output tokens requested from the model per completion. Defaults to `600`.
- `RESUME_TEXT_BATCH_SIZE`: Number of CVs generated per LLM request. Defaults to `2`.
- `RESUME_DEFAULT_LANGUAGE`: Default resume language when the API request does not send one. Supported values: `en`, `es-ES`.

## Next Planned Steps

- Replace the handwritten PDF renderer with an HTML-to-PDF pipeline based on browser automation, keeping HTML as a temporary intermediate artifact only.
- Add more resume templates and per-template layout rules for short and long CVs.
- Improve generated text quality so candidate profiles read less templated and more human.
- Build the PDF ingestion and hybrid RAG pipeline on top of the freshly generated local dataset.
