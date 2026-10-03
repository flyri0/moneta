// Writes the user guide into <out>/guide/ (default: build/guide/). It runs after `vite build`, so
// nothing it writes is in the service worker's precache: the guide is fetched only when opened.
import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GUIDE_LOCALES, GUIDE_PAGES, guidePath } from '../src/core/client/guide.ts';
import { checkLinks, parsePage, renderPage, type ParsedPage } from './render.ts';

const here = import.meta.dirname;
/** The guide's stylesheet. */
export const GUIDE_CSS = join(here, 'guide.css');
/**
 * Where the guide's images come from, first match wins: its own screenshots (`pnpm
 * guide:screenshots`), then the README's, so those are kept up to date in one place.
 */
const IMAGE_DIRS = [join(here, 'img'), join(here, '..', '.github', 'screenshots')];

/** The file behind an image of the guide. Throws when there is none. */
export async function imageFile(name: string): Promise<string> {
	for (const dir of IMAGE_DIRS) {
		const file = join(dir, name);
		if (
			await access(file).then(
				() => true,
				() => false
			)
		)
			return file;
	}
	throw new Error(`No image ${name} in guide/img or .github/screenshots`);
}

/** Parses every page in every language, and fails on a missing page or a broken link. */
export async function loadGuide(): Promise<ParsedPage[]> {
	const pages: ParsedPage[] = [];
	for (const locale of GUIDE_LOCALES) {
		const dir = join(here, 'content', locale);
		const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
		const expected = GUIDE_PAGES.map((p) => `${p}.md`).sort();
		if (files.join() !== expected.join()) {
			throw new Error(`guide/content/${locale} must hold exactly: ${expected.join(', ')}`);
		}
		for (const slug of GUIDE_PAGES) {
			pages.push(parsePage(locale, slug, await readFile(join(dir, `${slug}.md`), 'utf8')));
		}
	}
	checkLinks(pages);
	return pages;
}

/** Every page's HTML by its address (`/guide/`, `/guide/pt-BR/budgeting/`…), and the images used. */
export async function renderGuide(): Promise<{ pages: Map<string, string>; images: string[] }> {
	const parsed = await loadGuide();
	const pages = new Map<string, string>();
	for (const locale of GUIDE_LOCALES) {
		const own = parsed.filter((p) => p.locale === locale);
		for (const page of own) pages.set(guidePath(locale, page.slug), renderPage(page, own));
	}
	return { pages, images: [...new Set(parsed.flatMap((p) => p.images))] };
}

export async function buildGuide(out: string): Promise<void> {
	const { pages, images } = await renderGuide();
	const root = join(out, 'guide');
	await rm(root, { recursive: true, force: true });
	for (const [path, html] of pages) {
		const dir = join(out, path);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, 'index.html'), html);
	}
	await copyFile(GUIDE_CSS, join(root, 'guide.css'));
	await mkdir(join(root, 'img'), { recursive: true });
	for (const image of images) await copyFile(await imageFile(image), join(root, 'img', image));
}

if (import.meta.main) {
	const out = process.argv[2] ?? 'build';
	await buildGuide(out);
	console.log(`guide written to ${join(out, 'guide')}`);
}
