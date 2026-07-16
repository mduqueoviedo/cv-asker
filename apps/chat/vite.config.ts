import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  base: '/chat/',
  build: {
    outDir: path.join(currentDirectory, 'dist'),
    emptyOutDir: true,
  },
});
