import { defineConfig } from '@playwright/test';

/** The production build, served like a static host. Shared with guide/playwright.config.ts. */
export const webServer = {
	command: 'pnpm build && pnpm preview',
	port: 4173,
	reuseExistingServer: true,
	// Shows Google Drive backups; the tests answer Google's addresses with a fake Drive.
	env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client-id' }
};

export default defineConfig({
	webServer,
	// Only this folder: a worktree under .claude/ would bring a second copy of Playwright.
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	// Every test has its own browser context (OPFS, tab lock), so tests in one file run in parallel.
	fullyParallel: true,
	// On CI a test that fails once is tried again, so a slow runner doesn't block a deploy; the
	// report still lists it as flaky, with a trace of the failed attempt.
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL: 'http://localhost:4173',
		trace: process.env.CI ? 'retain-on-first-failure' : 'off'
	}
});
