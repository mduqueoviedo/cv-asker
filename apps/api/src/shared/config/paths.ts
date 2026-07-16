import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const apiSourceDirectory = path.resolve(currentDirectory, '../..');
export const apiPackageDirectory = path.resolve(currentDirectory, '../../..');
export const repositoryRootDirectory = path.resolve(currentDirectory, '../../../../..');
export const storageDirectory = path.join(repositoryRootDirectory, 'storage');
export const generatedResumesDirectory = path.join(storageDirectory, 'generated-resumes');
export const importedResumePdfDirectory = path.join(
  storageDirectory,
  'imported-resumes',
  'pdfs'
);
export const ragStorageDirectory = path.join(storageDirectory, 'rag');
export const chatDistributionDirectory = path.join(repositoryRootDirectory, 'apps', 'chat', 'dist');
