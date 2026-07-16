import { runSmokeSuite } from './smoke-suite.shared.js';

const mode = process.argv.includes('--mode=costly') ? 'costly' : 'basic';

runSmokeSuite(mode).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Smoke Suite] Failed: ${message}`);
  process.exitCode = 1;
});
