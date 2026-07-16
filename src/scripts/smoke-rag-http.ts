import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';

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
    const [statusResponse, chatResponse, askResponse] = await Promise.all([
      fetch(`${baseUrl}/api/rag/status`),
      fetch(`${baseUrl}/chat`),
      fetch(`${baseUrl}/api/rag/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: 'Which candidates speak English and have backend experience?',
        }),
      }),
    ]);

    const statusPayload = (await statusResponse.json()) as Record<string, unknown>;
    const askPayload = (await askResponse.json()) as Record<string, unknown>;
    const chatHtml = await chatResponse.text();

    console.log(`[RAG HTTP Smoke] statusCode.status=${statusResponse.status}`);
    console.log(`[RAG HTTP Smoke] statusCode.chat=${chatResponse.status}`);
    console.log(`[RAG HTTP Smoke] statusCode.ask=${askResponse.status}`);
    console.log(`[RAG HTTP Smoke] status.indexBuilt=${String(statusPayload.indexBuilt)}`);
    console.log(
      `[RAG HTTP Smoke] ask.success=${String(askPayload.success)} chatTitlePresent=${String(
        chatHtml.includes('CV Asker')
      )}`
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
