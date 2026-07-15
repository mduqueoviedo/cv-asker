import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = path.join(process.cwd(), 'src', 'services', 'resumes', 'templates');
const targetDirectory = path.join(process.cwd(), 'dist', 'services', 'resumes', 'templates');

await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });
