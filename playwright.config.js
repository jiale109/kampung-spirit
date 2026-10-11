import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
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
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
