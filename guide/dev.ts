import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Plugin } from 'vite';
import { GUIDE_CSS, imageFile, renderGuide } from './build.ts';

/**
 * Serves the user guide under `/guide/` in `vite dev`, the way `pnpm build` writes it, so it
 * doesn't fall through to the app's "Page not found". Pages are rendered again on every request:
 * an edit to the Markdown shows on reload. A broken page answers with the error.
 */
export function guideDevServer(): Plugin {
	return {
		name: 'moneta-guide-dev',
		apply: 'serve',
		configureServer(server) {
			// Added here rather than in a returned hook, so it runs before SvelteKit's middleware.
			server.middlewares.use(async (req, res, next) => {
				const path = new URL(req.url ?? '/', 'http://localhost').pathname;
				if (path !== '/guide' && !path.startsWith('/guide/')) return next();
				try {
					const file = await guideFile(path);
					if (!file) {
						res.statusCode = 404;
						res.setHeader('Content-Type', 'text/plain; charset=utf-8');
						res.end(`No guide page at ${path}`);
						return;
					}
					res.setHeader('Content-Type', file.type);
					res.setHeader('Cache-Control', 'no-store');
					res.end(file.body);
				} catch (error) {
					res.statusCode = 500;
					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.end(error instanceof Error ? error.message : String(error));
				}
			});
		}
	};
}

async function guideFile(path: string): Promise<{ type: string; body: string | Buffer } | null> {
	if (path === '/guide/guide.css') {
		return { type: 'text/css; charset=utf-8', body: await readFile(GUIDE_CSS) };
	}
	if (path.startsWith('/guide/img/')) {
		const { images } = await renderGuide();
		const name = basename(path);
		if (!images.includes(name)) return null;
		return { type: 'image/png', body: await readFile(await imageFile(name)) };
	}
	const { pages } = await renderGuide();
	const html = pages.get(path.endsWith('/') ? path : `${path}/`);
	return html === undefined ? null : { type: 'text/html; charset=utf-8', body: html };
}
