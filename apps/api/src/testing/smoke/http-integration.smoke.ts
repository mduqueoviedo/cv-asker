import type { AddressInfo } from 'node:net';
import { createApp } from '../../app/create-app.js';

async function main() {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => {
      resolve(listener);
    });

    listener.on('error', reject);
  });
  const address = server.address() as AddressInfo | null;

  if (!address) {
    throw new Error('Failed to allocate a local HTTP port for the smoke test.');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[RAG HTTP Smoke] baseUrl=${baseUrl}`);

  try {
    const [rootResponse, statusResponse, chatResponse] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/api/ingestion/status`),
      fetch(`${baseUrl}/chat`),
    ]);

    const rootPayload = (await rootResponse.json()) as Record<string, unknown>;
    const statusPayload = (await statusResponse.json()) as Record<string, unknown>;
    const chatHtml = await chatResponse.text();

    console.log(`[RAG HTTP Smoke] statusCode.root=${rootResponse.status}`);
    console.log(`[RAG HTTP Smoke] statusCode.status=${statusResponse.status}`);
    console.log(`[RAG HTTP Smoke] statusCode.chat=${chatResponse.status}`);
    console.log(`[RAG HTTP Smoke] root.apiBasePath=${String(rootPayload.apiBasePath ?? '')}`);
    console.log(`[RAG HTTP Smoke] status.indexBuilt=${String(statusPayload.indexBuilt)}`);
    console.log(
      `[RAG HTTP Smoke] chatTitlePresent=${String(chatHtml.includes('CV Asker'))}`
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[RAG HTTP Smoke] Failed: ${message}`);
  process.exitCode = 1;
});
