import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: true,
		// Shows Google Drive backups; the tests answer Google's addresses with a fake Drive.
		env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client-id' }
	},
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: 'http://localhost:4173' }
});
