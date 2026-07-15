import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '..');
const templatesDirectory = path.join(projectRoot, 'src', 'services', 'resumes', 'templates');
const tailwindCliPath = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss'
);

const templateFiles = (await readdir(templatesDirectory))
  .filter((fileName) => fileName.endsWith('.css') && !fileName.endsWith('.generated.css'))
  .sort();

for (const fileName of templateFiles) {
  const inputPath = path.join(templatesDirectory, fileName);
  const outputPath = path.join(
    templatesDirectory,
    fileName.replace(/\.css$/, '.generated.css')
  );

  console.log(`[Styles] Building ${fileName}...`);

  await execFileAsync(tailwindCliPath, ['-i', inputPath, '-o', outputPath, '--minify'], {
    cwd: projectRoot,
  });
}
