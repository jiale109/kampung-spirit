import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  /*
    Every test signs up real Supabase accounts, and a run makes about a hundred
    of them. Supabase throttles sign-ups per address, so one test in a batch can
    be turned away through no fault of its own. One retry lets it through;
    anything that fails twice is a real failure.
  */
  retries: 1,
  /*
    Long, because a sign-up turned away by Supabase's rate limit waits for its
    window before trying again (see signUp in e2e/helpers.js). This is only a
    ceiling for a test that hangs: a test with a wrong expectation still fails
    on that expectation in about 5 seconds.
  */
  timeout: 4 * 60 * 1000,
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only needed if Playwright cannot find its own browser (e.g. a sandbox)
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
      },
    },
  ],
  // Start the dev server before running the tests
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
