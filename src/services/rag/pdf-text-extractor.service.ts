import { spawn } from 'node:child_process';

const DEFAULT_EXTRACTION_TIMEOUT_MS = 15_000;

export interface ExtractPdfTextOptions {
  preserveLayout?: boolean;
  timeoutMs?: number;
}

export class PdfTextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfTextExtractionError';
  }
}

export async function extractPdfText(
  pdfFilePath: string,
  options: ExtractPdfTextOptions = {}
): Promise<string> {
  const preserveLayout = options.preserveLayout ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const args = preserveLayout
      ? ['-enc', 'UTF-8', '-layout', pdfFilePath, '-']
      : ['-enc', 'UTF-8', pdfFilePath, '-'];
    const process = spawn('pdftotext', args);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(
        new PdfTextExtractionError(
          `Timed out while extracting text from PDF "${pdfFilePath}" after ${timeoutMs}ms.`
        )
      );
    }, timeoutMs);

    process.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    process.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    process.on('error', (error) => {
      clearTimeout(timeout);

      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new PdfTextExtractionError(
            'The `pdftotext` binary is not available on this machine. Install poppler-utils to continue.'
          )
        );
        return;
      }

      reject(
        new PdfTextExtractionError(
          `Failed to start PDF text extraction for "${pdfFilePath}": ${error.message}`
        )
      );
    });

    process.on('close', (code, signal) => {
      clearTimeout(timeout);

      if (signal) {
        reject(
          new PdfTextExtractionError(
            `PDF text extraction for "${pdfFilePath}" terminated with signal ${signal}.`
          )
        );
        return;
      }

      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        reject(
          new PdfTextExtractionError(
            `pdftotext failed for "${pdfFilePath}" with exit code ${code}.${stderr ? ` ${stderr}` : ''}`
          )
        );
        return;
      }

      resolve(Buffer.concat(stdoutChunks).toString('utf8'));
    });
  });
}
