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
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: 'http://localhost:4173' }
});
