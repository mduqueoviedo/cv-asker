# CV Asker Architecture

This document describes the implemented end-to-end flow of CV Asker and the current repository organization.

## Core Rule

- The PDF is the source of truth for RAG ingestion.
- Derived CV metadata is not used as an ingestion input.
- The original requirements PDF is stored locally at `.local/requirements/ai-full-stack-developer-business-case.pdf` and excluded from git.

## System Diagram

```mermaid
flowchart LR
    A[cv-generation] --> B[PDF Resume Dataset]
    B --> C[cv-ingestion]
    C --> D[PDF Text Extraction]
    D --> E[Text Normalization]
    E --> F[Section Parsing and Chunking]
    E --> G[Structured Inference]
    F --> H[Local RAG Index]
    G --> H
    H --> I[chat]
    I --> J[Grounded Answer]
    J --> K[/chat and /api/chat/ask]
```

## Repository Structure

The project is still one deployable system, but it is organized as a modular monolith.

```text
apps/
  api/
    src/
      app/        # Express bootstrap and top-level routing
      modules/
        cv-generation/
        cv-ingestion/
        chat/
      shared/     # AI clients, shared config, shared low-level types
  chat/
    src/          # Vite + Vanilla TypeScript UI
```

This separation keeps the three product areas visible without splitting them into separate services too early.

## Runtime Flow

1. A local batch of fake resumes is generated as PDFs.
2. The PDFs are parsed directly with a local text-extraction tool.
3. The extracted text is normalized to reduce layout noise.
4. The normalized text is split into sections such as summary, experience, education, languages, and skills.
5. Those sections are chunked and combined with structured signals inferred from the same PDF text.
6. A local searchable index is built from chunks plus inferred candidate facets.
7. User questions are answered through hybrid retrieval and grounded response generation, with source excerpts attached.

At runtime:

- `apps/chat` is built as static assets
- `apps/api` serves those assets at `/chat`
- the UI calls `/api/ingestion/*`, `/api/chat/*`, and the legacy `/api/rag/*` aliases if needed

## Validation Strategy

The project uses a very small smoke-testing layer instead of a broader automated test suite.

The goal is practical validation of the critical product flows while the codebase is still evolving quickly:

- build and typecheck still work
- CV extraction still works against the current dataset
- RAG indexing still completes successfully
- local HTTP integration can still be checked when needed
- grounded asking can still be checked when AI credentials are available

The smoke tests live in:

- `apps/api/src/testing/smoke`

The main entry points are:

- `pnpm test:smoke`
- `pnpm test:smoke:http`
- `pnpm test:smoke:ai`
- `pnpm test:smoke:full`

The default baseline is `pnpm test:smoke`.

That baseline is intentionally conservative:

- it avoids the HTTP smoke by default because opening a local port depends on the environment
- it avoids the AI smoke by default because that may call the configured external LLM provider

This keeps the default validation loop fast, local-first, and easier to explain in demos or reviews.

## Retrieval Model

The current RAG layer combines:

- local hashed-vector similarity over chunk text
- lexical overlap on query terms
- lightweight structured filters such as languages and minimum experience
- section-aware boosts for experience, education, certifications, and skills

If the remote LLM is unavailable, the system returns a deterministic local fallback answer instead of failing hard.

## Parsing Strategy

The parser is heuristic-based and intentionally generic.

It relies on:

- bilingual heading aliases
- date-range detection
- contact-pattern detection
- education and certification keywords
- language-plus-level pairs
- action-oriented work-history verbs

This is meant to generalize beyond software CVs, although very unusual PDF layouts may still need tuning.

## Main Configuration

The main product configuration lives in:

- `apps/api/src/shared/config/resume-generation.ts`

That file centralizes:

- resume generation defaults
- fallback text-generation models
- image-generation settings
- RAG answer model
- retry and timeout settings
