# CV Asker

CV Asker is a local-first full-stack recruitment prototype. The project combines realistic PDF resume generation, a hybrid RAG ingestion pipeline, and a conversational interface that can answer questions about candidate profiles with source attribution.

## Current Backend Foundations

- Express + TypeScript running in ESM mode with `NodeNext` module resolution.
- Native `fetch` integration with OpenRouter for LLM access.
- Modular backend layout for routes, controllers, configuration, and AI services.
- Requirements document stored at `docs/project-requirements.md`.

## Available Scripts

- `pnpm dev`: Run the backend in watch mode.
- `pnpm build`: Compile the TypeScript backend into `dist`.

## Environment Variables

Copy `.env.example` into `.env` and provide a valid OpenRouter API key.

- `PORT`: Local backend port.
- `OPENROUTER_API_KEY`: API key used for chat completions.
- `OPENROUTER_MODEL`: Optional OpenRouter model override.
