import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    /*
      Only the unit tests under src/.

      Without this, Vitest would also pick up the Playwright specs in e2e/,
      because the slides' default is "every *.spec.js in the folder". Those
      import @playwright/test and drive a real browser, so Vitest cannot run
      them and the whole command fails.

          pnpm test:unit   -> these, in Node, in about a second
          pnpm test:e2e    -> the Playwright specs, in a real browser
    */
    include: ['src/**/*.spec.js'],
    environment: 'node',
  },
})
