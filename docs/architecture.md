# CV Asker Architecture

This document describes the implemented end-to-end flow of CV Asker and the current repository organization.

## Core Rule

- The PDF is the source of truth for RAG ingestion.
- Derived CV metadata is not used as an ingestion input.
- The original requirements PDF is stored locally at `.local/requirements/ai-full-stack-developer-business-case.pdf` and excluded from git.

## System Diagram

Static SVG version:

- `docs/architecture-diagram.svg`

```mermaid
flowchart LR
    subgraph GEN[1. CV Generation]
        A[Candidate draft generation]
        B[Resume HTML plus template styles]
        C[(PDF resumes in storage/resumes/pdfs)]
        A --> B --> C
    end

    subgraph INGEST[2. PDF Ingestion and Indexing]
        D[PDF text extraction with pdftotext]
        E[Normalization plus section parsing]
        F[Chunks plus structured candidate metadata]
        G[(Local RAG index in storage/rag/index)]
        C --> D --> E --> F --> G
    end

    subgraph CHAT[3. Chat Experience]
        H[Chat UI at /chat]
        I[Express API routes]
        J[Hybrid retrieval: semantic plus lexical plus filters]
        K[Grounded answer generation]
        L[Answer with source citations]
        H --> I --> J --> K --> L
    end

    G --> J
    C -. PDF source of truth .-> J
```

## Technical Architecture Diagram

Static SVG version:

- `docs/technical-architecture-diagram.svg`

```mermaid
flowchart TB
    U[User]

    subgraph SURFACE[Product Surface]
        FE[Chat UI<br/>apps/chat<br/>Vite plus Vanilla TypeScript]
    end

    subgraph APP[Application Core]
        API[Express API<br/>apps/api]
        CHAT[chat module]
        GEN[cv-generation module]
        INGEST[cv-ingestion module]
        API --> CHAT
        API --> GEN
        API --> INGEST
    end

    subgraph SUPPORT[Supporting Systems]
        PDFS[(storage/resumes/pdfs)]
        RAG[(storage/rag/index)]
        PUP[Puppeteer plus Chromium]
        PDFTEXT[pdftotext]
        OR[OpenRouter]
    end

    U --> FE --> API
    GEN --> PUP
    GEN --> PDFS
    GEN --> OR
    PDFS --> INGEST
    INGEST --> PDFTEXT
    INGEST --> RAG
    CHAT --> RAG
    CHAT --> OR
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

At the HTTP layer, the code stays intentionally thin:

- top-level API route wiring lives in `apps/api/src/app/api-router.ts`
- those handlers validate input, call the domain services, and preserve the legacy `/api/rag/*` aliases
- business logic remains in the domain services under `modules/`

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
- the UI calls `/api/ingestion/*`, `/api/chat/*`, `/api/resumes/:candidateId/pdf`, and the legacy `/api/rag/*` aliases if needed

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
- `pnpm test:smoke:costly`

The default baseline is `pnpm test:smoke`.

That baseline is intentionally conservative:

- it avoids the HTTP smoke by default because opening a local port depends on the environment
- it avoids the AI smoke by default because that may call the configured external LLM provider

The heavier suite is `pnpm test:smoke:costly`.

That one is intended for higher-confidence checks when you explicitly want to exercise the local HTTP layer and a real AI-backed ask.

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

The generated resume template CSS files are build outputs, not source-of-truth files:

- they are produced from the template `.css` sources by `apps/api/scripts/build-resume-styles.mjs`
- they are regenerated by the standard `dev`, `build`, and `generate` commands
- they are intentionally not tracked in git
