import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiPackageDirectory = path.resolve(currentDirectory, '..');
const sourceDirectory = path.join(
  apiPackageDirectory,
  'src',
  'modules',
  'cv-generation',
  'templates'
);
const targetDirectory = path.join(
  apiPackageDirectory,
  'dist',
  'modules',
  'cv-generation',
  'templates'
);

await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });
