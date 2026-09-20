import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm build && pnpm preview', port: 4173, reuseExistingServer: true },
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: 'http://localhost:4173' }
});
