import { defineConfig } from '@playwright/test';
import base, { webServer } from '../playwright.config';

/** `pnpm guide:screenshots`: takes the guide's screenshots (screenshots.ts) from the demo. */
export default defineConfig({
	...base,
	testDir: '.',
	testMatch: 'screenshots.ts',
	webServer: { ...webServer, cwd: '..' }
});
