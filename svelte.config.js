import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
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
