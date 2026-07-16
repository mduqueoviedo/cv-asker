import { createApp } from './app/create-app.js';
import { env } from './shared/config/env.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`[Server System]: Listening active on http://localhost:${env.port}`);
});
