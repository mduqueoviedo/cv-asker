import { access } from 'node:fs/promises';
import path from 'node:path';
import { getOpenRouterApiKey } from '../config/env.js';
import { generateResumeDataset } from '../services/resumes/resume-generator.service.js';
import type {
  ResumeDocumentLanguage,
  ResumeGenerationMode,
  ResumeTemplateId,
} from '../types/resume.js';

interface SmokeOptions {
  count: number;
  mode: ResumeGenerationMode;
  language: ResumeDocumentLanguage;
  template: ResumeTemplateId;
  llmModel?: string;
}

function parseArguments(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    count: 25,
    mode: 'replace',
    language: 'es-ES',
    template: 'aurora-split',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    if (argument === '--count' && nextValue) {
      options.count = Number(nextValue);
      index += 1;
      continue;
    }

    if (argument === '--mode' && nextValue) {
      if (nextValue !== 'replace' && nextValue !== 'append') {
        throw new Error('`--mode` must be either `replace` or `append`.');
      }

      options.mode = nextValue;
      index += 1;
      continue;
    }

    if (argument === '--language' && nextValue) {
      if (nextValue !== 'en' && nextValue !== 'es-ES') {
        throw new Error('`--language` must be either `en` or `es-ES`.');
      }

      options.language = nextValue;
      index += 1;
      continue;
    }

    if (argument === '--template' && nextValue) {
      if (nextValue !== 'aurora-split') {
        throw new Error('`--template` must be `aurora-split`.');
      }

      options.template = nextValue;
      index += 1;
      continue;
    }

    if (argument === '--model' && nextValue) {
      options.llmModel = nextValue;
      index += 1;
      continue;
    }

    if (argument === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isInteger(options.count)) {
    throw new Error('`--count` must be an integer.');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: pnpm smoke:resumes -- [options]

Options:
  --count <number>       Number of CVs to generate. Default: 25
  --mode <replace|append>
                         Generation mode. Default: replace
  --language <en|es-ES>  Resume language. Default: es-ES
  --template <id>        Resume template. Default: aurora-split
  --model <name>         Optional OpenRouter model override
  --help                 Show this help message
`);
}

async function ensureStylesAreBuilt(template: ResumeTemplateId) {
  const stylesPath = path.join(
    process.cwd(),
    'src',
    'services',
    'resumes',
    'templates',
    `${template}.generated.css`
  );

  try {
    await access(stylesPath);
  } catch {
    throw new Error(
      `Missing compiled template CSS at ${stylesPath}. Run \`pnpm build:resume-styles\` first.`
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  await ensureStylesAreBuilt(options.template);
  getOpenRouterApiKey();

  console.log('[Smoke] Starting resume generation...');
  console.log(
    `[Smoke] count=${options.count} mode=${options.mode} language=${options.language} template=${options.template}`
  );

  const startedAt = Date.now();
  const manifest = await generateResumeDataset({
    count: options.count,
    mode: options.mode,
    language: options.language,
    template: options.template,
    llmModel: options.llmModel,
  });
  const elapsedMs = Date.now() - startedAt;

  console.log('[Smoke] Generation completed successfully.');
  console.log(`[Smoke] datasetId=${manifest.datasetId}`);
  console.log(`[Smoke] generated=${manifest.lastBatchCount} total=${manifest.count}`);
  console.log(`[Smoke] pdfDirectory=${manifest.pdfDirectory}`);
  console.log(`[Smoke] metadataDirectory=${manifest.metadataDirectory}`);
  console.log(`[Smoke] model=${manifest.lastTextGeneration.model}`);
  console.log(`[Smoke] elapsedMs=${elapsedMs}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
