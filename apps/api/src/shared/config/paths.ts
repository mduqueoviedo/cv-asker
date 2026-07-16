import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const apiSourceDirectory = path.resolve(currentDirectory, '../..');
export const repositoryRootDirectory = path.resolve(currentDirectory, '../../../../..');
const storageDirectory = path.join(repositoryRootDirectory, 'storage');
export const resumesDirectory = path.join(storageDirectory, 'resumes');
export const resumePdfDirectory = path.join(resumesDirectory, 'pdfs');
export const ragStorageDirectory = path.join(storageDirectory, 'rag');
export const chatDistributionDirectory = path.join(repositoryRootDirectory, 'apps', 'chat', 'dist');
