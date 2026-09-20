import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
	worker: { format: 'es' },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		}),
		SvelteKitPWA({
			// Ask before updating (spec §8): the app shows a "Reload" toast.
			registerType: 'prompt',
			injectRegister: false,
			// SvelteKit builds with relative asset paths; the service worker must live at the root.
			base: '/',
			scope: '/',
			kit: { adapterFallback: 'index.html', spa: true },
			manifest: {
				name: 'Moneta',
				short_name: 'Moneta',
				description: 'Zero-based envelope budgeting that stays on your device.',
				theme_color: '#0f766e',
				background_color: '#ffffff',
				display: 'standalone',
				// Not '/': the installed app skips the welcome page and goes to the budget.
				start_url: '/budget',
				scope: '/',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Precache everything, including SQLite's WebAssembly, so the app works offline.
				globPatterns: ['client/**/*.{js,css,html,ico,png,svg,webp,woff2,wasm,webmanifest}'],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
			}
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// A static SPA: remember the user's choice, else follow the browser, else English.
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
