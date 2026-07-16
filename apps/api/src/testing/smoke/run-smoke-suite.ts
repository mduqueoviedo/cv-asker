import { spawn } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importedResumePdfDirectory, repositoryRootDirectory } from '../../shared/config/paths.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

type SmokeMode = 'basic' | 'http' | 'ai' | 'full';

interface SmokeStep {
  label: string;
  command: string;
  args: string[];
}

function parseArguments(argv: string[]): SmokeMode {
  if (argv.includes('--full')) {
    return 'full';
  }

  if (argv.includes('--http')) {
    return 'http';
  }

  if (argv.includes('--ai')) {
    return 'ai';
  }

  return 'basic';
}

async function hasGeneratedDataset() {
  try {
    await access(path.join(repositoryRootDirectory, 'storage', 'generated-resumes', 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

async function hasImportedDataset() {
  try {
    const entries = await readdir(importedResumePdfDirectory);
    return entries.some((entry) => entry.toLowerCase().endsWith('.pdf'));
  } catch {
    return false;
  }
}

async function hasAnyDataset() {
  const [generated, imported] = await Promise.all([hasGeneratedDataset(), hasImportedDataset()]);
  return generated || imported;
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

async function main() {
  const mode = parseArguments(process.argv.slice(2));
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
      },
    );
  } else {
    console.log(
      '[Smoke Suite] No generated or imported dataset found. Skipping dataset-dependent smoke tests.'
    );
  }

  if ((mode === 'http' || mode === 'full') && datasetAvailable) {
    steps.push({
      label: 'http-integration',
      command: 'node',
      args: ['--import', 'tsx', smokeScript('http-integration.smoke.ts')],
    });
  }

  if (mode === 'ai' || mode === 'full') {
    if (datasetAvailable || mode === 'full') {
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

  if (mode === 'full') {
    steps.unshift({
      label: 'generate-resumes',
      command: 'pnpm',
      args: ['smoke:generate'],
    });
  }

  const startedAt = Date.now();

  for (const step of steps) {
    await runStep(step);
  }

  console.log(
    `[Smoke Suite] Completed mode=${mode} steps=${steps.length} elapsedMs=${Date.now() - startedAt}`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Smoke Suite] Failed: ${message}`);
  process.exitCode = 1;
});
