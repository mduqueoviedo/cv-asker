import { spawn } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRootDirectory, resumePdfDirectory } from '../../shared/config/paths.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

interface SmokeStep {
  label: string;
  command: string;
  args: string[];
}

interface RunSmokeSuiteOptions {
  includeHttp: boolean;
  includeAi: boolean;
  modeLabel: 'basic' | 'costly';
}

async function hasGeneratedDataset() {
  try {
    await access(path.join(repositoryRootDirectory, 'storage', 'resumes', 'generated-manifest.json'));
    return true;
  } catch {
    return false;
  }
}

async function hasLocalPdfDataset() {
  try {
    const entries = await readdir(resumePdfDirectory);
    return entries.some((entry) => entry.toLowerCase().endsWith('.pdf'));
  } catch {
    return false;
  }
}

async function hasAnyDataset() {
  const [generated, localPdfs] = await Promise.all([hasGeneratedDataset(), hasLocalPdfDataset()]);
  return generated || localPdfs;
}

async function runStep(step: SmokeStep) {
  console.log(`[Smoke Suite] Running ${step.label}...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: repositoryRootDirectory,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${step.label} exited with code ${code ?? 'unknown'}.`));
    });
  });
  console.log(`[Smoke Suite] OK ${step.label}`);
}

export async function runSmokeSuite(options: RunSmokeSuiteOptions) {
  const datasetAvailable = await hasAnyDataset();
  const smokeScript = (fileName: string) => path.join(currentDirectory, fileName);
  const steps: SmokeStep[] = [
    {
      label: 'typecheck',
      command: 'pnpm',
      args: ['typecheck'],
    },
    {
      label: 'build',
      command: 'pnpm',
      args: ['build'],
    },
  ];

  if (datasetAvailable) {
    steps.push(
      {
        label: 'extract-resume-text',
        command: 'node',
        args: ['--import', 'tsx', smokeScript('extract-resume-text.smoke.ts')],
      },
      {
        label: 'build-rag-index',
        command: 'node',
        args: ['--import', 'tsx', smokeScript('build-rag-index.smoke.ts')],
      }
    );
  } else {
    console.log('[Smoke Suite] No local PDF dataset found. Skipping dataset-dependent smoke tests.');
  }

  if (options.includeHttp && datasetAvailable) {
    steps.push({
      label: 'http-integration',
      command: 'node',
      args: ['--import', 'tsx', smokeScript('http-integration.smoke.ts')],
    });
  }

  if (options.includeAi) {
    if (datasetAvailable) {
      steps.push({
        label: 'ask-rag',
        command: 'node',
        args: [
          '--import',
          'tsx',
          smokeScript('ask-rag.smoke.ts'),
          'Which candidates speak English and have backend experience?',
        ],
      });
    } else {
      console.log('[Smoke Suite] Skipping ask-rag because no dataset is available.');
    }
  }

  if (options.includeHttp && !datasetAvailable) {
    console.log('[Smoke Suite] Skipping http-integration because no dataset is available.');
  }

  if (options.includeAi && !datasetAvailable) {
    console.log('[Smoke Suite] Skipping AI smoke because no dataset is available.');
  }

  const startedAt = Date.now();

  for (const step of steps) {
    await runStep(step);
  }

  console.log(
    `[Smoke Suite] Completed mode=${options.modeLabel} steps=${steps.length} elapsedMs=${Date.now() - startedAt}`
  );
}
