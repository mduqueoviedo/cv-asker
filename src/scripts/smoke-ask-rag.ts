import { answerResumeRagQuestion } from '../services/rag/rag-answer.service.js';

function parseQuestion(argv: string[]): string {
  const normalizedArgs = argv[0] === '--' ? argv.slice(1) : argv;
  const question = normalizedArgs.join(' ').trim();

  if (!question) {
    throw new Error('Provide a question after `pnpm rag:ask --`.');
  }

  return question;
}

async function main() {
  const question = parseQuestion(process.argv.slice(2));
  console.log(`[RAG Ask Smoke] question=${question}`);
  const startedAt = Date.now();
  const result = await answerResumeRagQuestion(question, {
    forceRebuild: false,
  });

  console.log('[RAG Ask Smoke] Answer generated successfully.');
  console.log(`[RAG Ask Smoke] datasetId=${result.datasetId}`);
  console.log(`[RAG Ask Smoke] model=${result.model ?? 'local-fallback'}`);
  console.log(`[RAG Ask Smoke] answer=${result.answer.replace(/\s+/g, ' ').trim()}`);
  console.log(
    `[RAG Ask Smoke] citations=${result.citations
      .map((citation) => `${citation.candidateId}:${citation.chunkId}`)
      .join(', ')}`
  );
  console.log(`[RAG Ask Smoke] matches=${result.matches.map((match) => match.candidateId).join(', ')}`);
  console.log(`[RAG Ask Smoke] elapsedMs=${Date.now() - startedAt}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RAG Ask Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
