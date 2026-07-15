# CV Asker Project Requirements

Consolidated from the original business case PDF and the project architecture instructions agreed for this repository.

## 1. Product Goal

Build an AI-powered CV screener that allows a user to ask natural-language questions about a locally generated dataset of fake resumes and receive grounded answers with source attribution.

## 2. Sequential Workflow Scope

1. **Dataset Generation:** Dynamically create 25-30 unique, realistic, fake resumes in PDF format and store them locally on the server.
2. **Hybrid RAG Pipeline:** Extract text from the generated PDFs, chunk the content, and store embeddings plus structured metadata such as name, age, education, primary role, spoken languages, and core technologies.
3. **Conversational Interface:** Provide a chat experience where users can ask semantic and structured questions about the candidate pool and see which source documents informed each answer.

## 3. Functional Requirements

### 3.1 Resume Dataset

- Generate 25-30 fake resumes in PDF format.
- Each resume should appear realistic and include a photo, contact information, work experience, skills, and education.
- Candidate profiles should be varied enough to support meaningful filtering and retrieval scenarios.
- All generated documents must be saved locally on the backend.

### 3.2 Hybrid RAG Requirements

- The system must extract and normalize text from all generated PDF resumes.
- Text must be chunked and stored in an embedded vector storage layer suitable for local development.
- Each chunk must preserve source-document references and structured candidate metadata.
- Retrieval must support both semantic similarity search and rigid quantitative filtering.
- LLM answers should be grounded in resume data only whenever feasible.

### 3.3 Chat Experience

- Provide a simple, responsive chat interface with question input and answer rendering.
- Answers must be based on ingested resume content and include source document attribution.
- The user experience should support questions such as technology matching, education lookup, and profile summarization.

## 4. Technology Requirements

### 4.1 Frontend

- Use a simple web frontend for the user-facing application.
- The frontend and backend should feel like one unified product.

### 4.2 Backend

- Use Node.js with TypeScript.
- Use ESM configuration with `NodeNext` module resolution.
- Use Express as the backend server framework.
- Use `pnpm` as the package manager and `tsx watch` for local development.

### 4.3 AI Integration

- Use OpenRouter as the LLM gateway provider.
- Prefer free high-performance models such as `meta-llama/llama-3.3-70b-instruct:free` unless a better local decision is justified.
- Use native HTTP `fetch` requests directly against `https://openrouter.ai/api/v1/chat/completions`.
- Avoid third-party SDK abstractions when native web or Node APIs are sufficient.

## 5. Architecture Rules

- All source code, comments, logs, architecture notes, and technical artifacts must be written in English.
- Use a modular backend architecture with separation between routes, controllers, services, configuration, and static templates.
- Avoid over-engineering and favor the fastest path to a reliable hybrid RAG implementation.
- Do not install redundant libraries when built-in platform APIs are enough.
- The final solution may run locally only; cloud deployment is optional.

## 6. Delivery Expectations

- A working local application demonstrating the complete pipeline.
- Source code included in the repository.
- A short video demonstration under five minutes explaining the generation flow, the RAG workflow, and the final chat experience.
- An optional architecture overview diagram is encouraged.

## 7. Evaluation Focus

- Execution and functional completeness.
- Clarity of architecture and technology choices.
- Readable, maintainable code quality.
- Creativity in solving AI workflow challenges.
- Practical AI literacy and adaptability.
