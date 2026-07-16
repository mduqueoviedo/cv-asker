import { buildResumeRagIndex } from '../../modules/cv-ingestion/services/cv-ingestion-index.service.js';

async function main() {
  console.log('[RAG Index Smoke] Building local RAG index...');
  const startedAt = Date.now();
  const index = await buildResumeRagIndex({ forceRebuild: true });

  console.log('[RAG Index Smoke] Index built successfully.');
  console.log(`[RAG Index Smoke] datasetId=${index.datasetId}`);
  console.log(`[RAG Index Smoke] candidates=${index.candidateCount}`);
  console.log(`[RAG Index Smoke] chunks=${index.chunkCount}`);
  console.log(`[RAG Index Smoke] builtAt=${index.builtAt}`);
  console.log(`[RAG Index Smoke] elapsedMs=${Date.now() - startedAt}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RAG Index Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
