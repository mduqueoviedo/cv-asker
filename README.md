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
- Image generation through native `fetch`, backed by OpenRouter.
- Shared AI HTTP retry layer with timeout and exponential backoff.
- Ordered OpenRouter fallback for lightweight resume-text enrichment.
- Centralized product defaults for models, limits, languages, templates, and AI request tuning in `src/config/resume-generation.ts`.
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
- `pnpm generate`: Run resume generation using the defaults defined in `src/config/resume-generation.ts`.
- `pnpm generate -- --count 12 --language en --mode append`: Override any default for a specific run without touching `.env`.

The backend starts on `http://localhost:3000` by default.

AI and generation defaults now live in `src/config/resume-generation.ts`, so `.env` stays focused on secrets and local runtime values.

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
- `src/services/ai/openrouter-image.service.ts`: implemented
- RAG ingestion services: `WIP`
- Retrieval services: `WIP`
- Chat orchestration: `WIP`
- Frontend application: `WIP`

## Resume Generation Notes

- Each dataset generation run supports `replace` or `append`.
- `replace` is the default mode and clears the previous output before generating a fresh dataset.
- `append` keeps the existing dataset and adds a new batch of resumes without reusing candidate ids or file names.
- The generator currently accepts between 1 and 30 resumes per generation run.
- Personal seed data and the full resume structure come from `faker` plus small local catalogs.
- OpenRouter is used only to enrich the professional summary and highlights, keeping token usage and failure surface low.
- The CV flow uses a generic image-generation layer to create a realistic synthetic profile photo for every candidate via OpenRouter image generation.
- Supported document languages are `en` and `es-ES`, and the default generation mode mixes both within the same dataset.
- Resume templates are now modeled explicitly so the renderer can move to HTML-to-PDF later without changing the dataset shape.
- Supported resume templates are `aurora-split` and `paper-compact`, and the default generation mode mixes both within the same dataset.
- HTML should be treated as a transient render step and cleaned up once its PDF counterpart has been produced.
- Output is written under `storage/generated-resumes/`.
- JSON metadata is stored only as a derived artifact of the fresh resumes, to support later ingestion steps, and each metadata file includes the final `documentLanguage` and `template` used for that candidate.
- Generated photos are used only during rendering and are not persisted as separate files.
- Each generated artifact records the language and the model used for text enrichment, or `local/base-profile` when the local copy is kept.
- When multiple models are configured, the generator tries them in order and keeps valid local copy if all enrichment attempts fail.
- The default photo model is `google/gemini-2.5-flash-image`.

Example request body:

```json
{
  "count": 28,
  "mode": "replace",
  "language": "mixed",
  "llmModels": [
    "google/gemini-2.5-flash-lite",
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-20b:free"
  ],
  "template": "mixed"
}
```

Example smoke command:

```bash
pnpm generate -- --count 25 --mode replace --language es-ES --template aurora-split
```

Example smoke command with explicit multi-model fallback:

```bash
pnpm generate -- --count 6 --mode replace --language es-ES --template aurora-split --models google/gemini-2.5-flash-lite,google/gemma-3-27b-it:free,openai/gpt-oss-20b:free
```

Default generation command:

```bash
pnpm generate
```

This command always runs in `replace` mode, so it removes the previously generated dataset before creating a new one. By default it also mixes the supported resume languages and templates inside the generated batch.

## Environment Variables

Copy `.env.example` into `.env`. `OPENROUTER_API_KEY` is required because CV generation now uses OpenRouter both for optional text enrichment and for image generation.

- `PORT`: Local backend port.
- `OPENROUTER_API_KEY`: API key used for resume-text enrichment and synthetic profile photo generation.

Product-level AI settings are now centralized in `src/config/resume-generation.ts`, including:

- Ordered fallback model list.
- AI request timeout, retries, and backoff.
- Completion token cap and LLM batch size.
- Default resume count, language, mode, and template.
- Default image model and image-generation parameters.

## Next Planned Steps

- Replace the handwritten PDF renderer with an HTML-to-PDF pipeline based on browser automation, keeping HTML as a temporary intermediate artifact only.
- Add more resume templates and per-template layout rules for short and long CVs.
- Improve generated text quality so candidate profiles read less templated and more human.
- Build the PDF ingestion and hybrid RAG pipeline on top of the freshly generated local dataset.
