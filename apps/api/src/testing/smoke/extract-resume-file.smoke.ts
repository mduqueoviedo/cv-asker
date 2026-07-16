import path from 'node:path';
import { extractSingleResumePdf } from '../../modules/cv-ingestion/services/resume-pdf-text.service.js';

function createPreview(text: string, maxLength = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3)}...`;
}

function parseArguments(argv: string[]) {
  const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv;
  const pdfFilePath = normalizedArgv[0];

  if (!pdfFilePath) {
    throw new Error('Usage: pnpm smoke:extract:file -- <pdf-file-path>');
  }

  return {
    pdfFilePath: path.resolve(pdfFilePath),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  console.log(`[RAG File Smoke] Starting PDF extraction for ${options.pdfFilePath}`);
  const startedAt = Date.now();
  const artifact = await extractSingleResumePdf(options.pdfFilePath, {
    persistArtifacts: true,
    preserveLayout: true,
  });

  console.log('[RAG File Smoke] Extraction completed successfully.');
  console.log(`[RAG File Smoke] candidateId=${artifact.document.candidateId}`);
  console.log(`[RAG File Smoke] fullName=${artifact.document.fullName}`);
  console.log(`[RAG File Smoke] chars=${artifact.document.stats.characterCount}`);
  console.log(`[RAG File Smoke] paragraphs=${artifact.document.stats.paragraphCount}`);
  console.log(`[RAG File Smoke] sections=${artifact.sections.length}`);
  console.log(`[RAG File Smoke] chunks=${artifact.chunks.length}`);
  console.log(
    `[RAG File Smoke] structured=experience:${artifact.structuredData.experience.length},education:${artifact.structuredData.education.length},languages:${artifact.structuredData.languages.length},certifications:${artifact.structuredData.certifications.length}`
  );
  console.log(
    `[RAG File Smoke] sectionKinds=${artifact.sections.map((section) => section.kind).join(',')}`
  );
  console.log(
    `[RAG File Smoke] sectionConfidence=${artifact.sections
      .map((section) => `${section.kind}:${section.confidence}`)
      .join(',')}`
  );
  console.log(`[RAG File Smoke] preview=${createPreview(artifact.document.normalizedText)}`);
  console.log(`[RAG File Smoke] elapsedMs=${Date.now() - startedAt}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RAG File Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
