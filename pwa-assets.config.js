// Generates the app icons in static/ from static/icon.svg: `pnpm icons`.
// A plain object (no import) so it runs through `pnpm dlx` without another dependency.
const background = '#0f766e';

export default {
	headLinkOptions: { preset: '2023' },
	preset: {
		transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
		maskable: { sizes: [512], padding: 0.3, resizeOptions: { background } },
		apple: { sizes: [180], padding: 0.3, resizeOptions: { background } }
	},
	images: ['static/icon.svg']
};
