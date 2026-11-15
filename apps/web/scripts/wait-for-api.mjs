import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const apiBaseUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const healthUrl = `${apiBaseUrl}/api/v1/health`;
const timeoutMs = 180_000;
const retryIntervalMs = 500;
const startedAt = Date.now();
let lastFailure = 'API health check has not completed yet.';
let isReady = false;

console.log(`Waiting for API health check at ${healthUrl}...`);

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      await response.arrayBuffer();
      console.log(`API is ready at ${apiBaseUrl}.`);
      isReady = true;
      break;
    }
    lastFailure = `Health endpoint returned HTTP ${response.status}.`;
    await response.body?.cancel();
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
}

if (!isReady) {
  console.error(
    `API did not become ready within ${timeoutMs / 1_000} seconds at ${healthUrl}. ${lastFailure}`,
  );
  process.exitCode = 1;
}
