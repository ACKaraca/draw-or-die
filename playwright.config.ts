import { execFileSync } from 'node:child_process';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STAGING_URL || 'http://localhost:3000';
const useExternalBaseURL = Boolean(process.env.STAGING_URL);
const LOCAL_DEPLOYMENT_ID = 'playwright-local';

function resolveLocalReleaseSha(): string {
  const configuredSha = process.env.RELEASE_SHA?.trim();
  if (configuredSha) return configuredSha;

  try {
    return execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error('Unable to resolve Git HEAD for local smoke release identity.', { cause: error });
  }
}

if (!useExternalBaseURL) {
  const localReleaseSha = resolveLocalReleaseSha();
  process.env.RELEASE_SHA = localReleaseSha;
  process.env.RELEASE_DEPLOYMENT_ID ??= LOCAL_DEPLOYMENT_ID;
  process.env.EXPECTED_RELEASE_SHA ??= localReleaseSha;
  process.env.EXPECTED_DEPLOYMENT_ID ??= process.env.RELEASE_DEPLOYMENT_ID;
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  webServer: useExternalBaseURL
    ? undefined
    : {
      command: 'npm run build && npm run start',
      url: baseURL,
      timeout: 180 * 1000,
      reuseExistingServer: !process.env.CI,
    },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
