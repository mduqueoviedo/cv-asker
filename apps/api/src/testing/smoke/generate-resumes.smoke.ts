import { access } from 'node:fs/promises';
import path from 'node:path';
import { hasOpenRouterApiKey } from '../../shared/config/env.js';
import {
  getDefaultResumeLlmModels,
  isResumeDocumentLanguage,
  isResumeTemplateId,
  resumeGenerationConfig,
  supportedResumeLanguages,
  supportedResumeTemplates,
} from '../../shared/config/resume-generation.js';
import { apiSourceDirectory } from '../../shared/config/paths.js';
import { generateResumeDataset } from '../../modules/cv-generation/services/resume-generator.service.js';
import type {
  ResumeDocumentLanguageSelection,
  ResumeGenerationMode,
  ResumeTemplateSelection,
} from '../../modules/cv-generation/types/resume.js';

interface SmokeOptions {
  count: number;
  mode: ResumeGenerationMode;
  language: ResumeDocumentLanguageSelection;
  template: ResumeTemplateSelection;
  llmModel?: string;
  llmModels?: string[];
}

function parseModelList(value: string): string[] {
  const models = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (models.length === 0) {
    throw new Error('`--models` must include at least one model id.');
  }

  return [...new Set(models)];
}

function parseArguments(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    count: resumeGenerationConfig.defaults.count,
    mode: resumeGenerationConfig.defaults.mode,
    language: resumeGenerationConfig.defaults.language,
    template: resumeGenerationConfig.defaults.template,
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
      if (nextValue !== 'mixed' && !isResumeDocumentLanguage(nextValue)) {
        throw new Error('`--language` must be `en`, `es-ES`, or `mixed`.');
      }

      options.language = nextValue;
      index += 1;
      continue;
    }

    if (argument === '--template' && nextValue) {
      if (nextValue !== 'mixed' && !isResumeTemplateId(nextValue)) {
        throw new Error(
          `\`--template\` must be one of: ${supportedResumeTemplates.join(', ')}, or \`mixed\`.`
        );
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

    if (argument === '--models' && nextValue) {
      options.llmModels = parseModelList(nextValue);
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
  console.log(`Usage: pnpm generate -- [options]

Options:
  --count <number>       Number of CVs to generate. Default: ${resumeGenerationConfig.defaults.count}
  --mode <replace|append>
                         Generation mode. Default: ${resumeGenerationConfig.defaults.mode}
  --language <en|es-ES|mixed>
                         Resume language selection. Supported languages: ${supportedResumeLanguages.join(', ')}. Default: ${resumeGenerationConfig.defaults.language}
  --template <id|mixed>  Resume template (${supportedResumeTemplates.join(', ')}). Default: ${resumeGenerationConfig.defaults.template}
  --model <name>         Optional OpenRouter model override
  --models <a,b,c>       Optional comma-separated OpenRouter fallback list
  --help                 Show this help message
`);
}

async function ensureStylesAreBuilt(templateSelection: ResumeTemplateSelection) {
  const templates =
    templateSelection === 'mixed' ? [...supportedResumeTemplates] : [templateSelection];

  for (const template of templates) {
    const stylesPath = path.join(
      apiSourceDirectory,
      'modules',
      'cv-generation',
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
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  await ensureStylesAreBuilt(options.template);

  const effectiveModels =
    options.llmModels ??
    (options.llmModel ? [options.llmModel] : getDefaultResumeLlmModels());

  console.log('[Smoke] Preflight checks passed.');
  if (!hasOpenRouterApiKey()) {
    throw new Error('Image generation credentials are required to generate realistic resume photos.');
  }
  console.log('[Smoke] Starting resume generation...');
  console.log(
    `[Smoke] count=${options.count} mode=${options.mode} language=${options.language} template=${options.template}`
  );
  console.log(`[Smoke] models=${effectiveModels.join(', ')}`);

  const startedAt = Date.now();
  const manifest = await generateResumeDataset({
    count: options.count,
    mode: options.mode,
    language: options.language,
    template: options.template,
    llmModel: options.llmModel,
    llmModels: options.llmModels,
  });
  const elapsedMs = Date.now() - startedAt;

  console.log('[Smoke] Generation completed successfully.');
  console.log(`[Smoke] datasetId=${manifest.datasetId}`);
  console.log(`[Smoke] generated=${manifest.lastBatchCount} total=${manifest.count}`);
  console.log(`[Smoke] pdfDirectory=${manifest.pdfDirectory}`);
  console.log(`[Smoke] preferredModel=${manifest.lastTextGeneration.model}`);
  console.log(`[Smoke] strategy=${manifest.lastTextGeneration.strategy}`);
  console.log(`[Smoke] batchLanguages=${manifest.lastBatchLanguages.join(', ')}`);
  console.log(`[Smoke] batchTemplates=${manifest.lastBatchTemplates.join(', ')}`);
  console.log(`[Smoke] configuredModels=${manifest.lastTextGeneration.models.join(', ')}`);
  console.log(`[Smoke] usedModels=${manifest.lastTextGeneration.usedModels.join(', ')}`);
  console.log(`[Smoke] enrichedProfiles=${manifest.lastTextGeneration.enrichedProfileCount}`);
  console.log(`[Smoke] localProfiles=${manifest.lastTextGeneration.localProfileCount}`);
  console.log(`[Smoke] elapsedMs=${elapsedMs}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
