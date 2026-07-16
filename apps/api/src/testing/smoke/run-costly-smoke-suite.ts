import { runSmokeSuite } from './smoke-suite.shared.js';

runSmokeSuite({
  includeHttp: true,
  includeAi: true,
  modeLabel: 'costly',
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Smoke Suite] Failed: ${message}`);
  process.exitCode = 1;
});
