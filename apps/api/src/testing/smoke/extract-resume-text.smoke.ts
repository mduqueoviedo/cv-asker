import { extractResumeDatasetText } from '../../modules/cv-ingestion/services/resume-pdf-text.service.js';

function createPreview(text: string, maxLength = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3)}...`;
}

async function main() {
  console.log('[RAG Smoke] Starting PDF text extraction...');
  const startedAt = Date.now();
  const result = await extractResumeDatasetText({
    persistArtifacts: true,
    preserveLayout: true,
  });

  console.log('[RAG Smoke] Extraction completed successfully.');
  console.log(`[RAG Smoke] datasetId=${result.datasetId}`);
  console.log(`[RAG Smoke] documents=${result.documents.length}`);

  if (result.artifactDirectory) {
    console.log(`[RAG Smoke] artifactDirectory=${result.artifactDirectory}`);
  }

  for (const artifact of result.documents) {
    const { document } = artifact;
    console.log(
      `[RAG Smoke] ${document.candidateId} chars=${document.stats.characterCount} words=${document.stats.wordCount} paragraphs=${document.stats.paragraphCount} sections=${artifact.sections.length} chunks=${artifact.chunks.length} experienceEntries=${artifact.structuredData.experience.length} educationEntries=${artifact.structuredData.education.length}`
    );
  }

  const firstArtifact = result.documents[0];

  if (firstArtifact) {
    console.log(`[RAG Smoke] sampleCandidate=${firstArtifact.document.candidateId}`);
    console.log(`[RAG Smoke] samplePreview=${createPreview(firstArtifact.document.normalizedText)}`);
    console.log(
      `[RAG Smoke] sampleSectionKinds=${firstArtifact.sections.map((section) => section.kind).join(',')}`
    );
    console.log(
      `[RAG Smoke] sampleStructured=experience:${firstArtifact.structuredData.experience.length},education:${firstArtifact.structuredData.education.length},languages:${firstArtifact.structuredData.languages.length},certifications:${firstArtifact.structuredData.certifications.length}`
    );
  }

  console.log(`[RAG Smoke] elapsedMs=${Date.now() - startedAt}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RAG Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
