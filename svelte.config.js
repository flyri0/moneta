import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		// Shipped as a <meta> tag in the static build, so it needs nothing from the host.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				// sqlite-wasm compiles its WebAssembly at runtime.
				'script-src': ['self', 'wasm-unsafe-eval'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				// Backups to Google Drive (its API, and revoking access on disconnect).
				'connect-src': ['self', 'https://www.googleapis.com', 'https://oauth2.googleapis.com'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['none'],
				'form-action': ['none']
			}
		},
		// The optional Netlify function (cloud backup tokens) is type-checked with the app.
		typescript: {
			config: (config) => ({
				...config,
				include: [...config.include, '../netlify/**/*.ts', '../netlify/**/*.mts']
			})
		},
		alias: {
			$domain: 'src/core/domain',
			'$domain/*': 'src/core/domain/*',
			$db: 'src/core/db',
			'$db/*': 'src/core/db/*',
			$client: 'src/core/client',
			'$client/*': 'src/core/client/*',
			$i18n: 'src/core/i18n',
			'$i18n/*': 'src/core/i18n/*',
			$features: 'src/features',
			'$features/*': 'src/features/*',
			$components: 'src/components',
			'$components/*': 'src/components/*',
			$ui: 'src/components/ui',
			'$ui/*': 'src/components/ui/*',
			$utils: 'src/utils'
		}
	}
};

export default config;
