import { Marked, type Tokens } from 'marked';
import {
	GUIDE_LOCALES,
	GUIDE_PAGES,
	guidePath,
	type GuideLocale,
	type GuidePage
} from '../src/core/client/guide.ts';

/** A heading of a guide page, with the id its address ends in. */
export interface Heading {
	id: string;
	/** As HTML text: escaped, without tags. */
	text: string;
	depth: number;
}

/** One guide page, parsed from its Markdown. */
export interface ParsedPage {
	locale: GuideLocale;
	slug: GuidePage;
	/** The page's `#` heading, as HTML text (escaped, without tags). */
	title: string;
	/** The HTML of everything below the title. */
	body: string;
	headings: Heading[];
	/** The links to other guide pages, as `page#anchor` (or `page` alone). */
	links: string[];
	/** The images it shows, as file names in `img/` (with the dark versions of `-light` ones). */
	images: string[];
}

/** The words of the page around the content, per language. */
const CHROME: Record<
	GuideLocale,
	{
		guide: string;
		contents: string;
		onThisPage: string;
		previous: string;
		next: string;
		open: string;
		language: string;
		skip: string;
		languageName: string;
	}
> = {
	en: {
		guide: 'Moneta guide',
		contents: 'Contents',
		onThisPage: 'On this page',
		previous: 'Previous',
		next: 'Next',
		open: 'Open Moneta',
		language: 'Language',
		skip: 'Skip to content',
		languageName: 'English'
	},
	'pt-BR': {
		guide: 'Guia do Moneta',
		contents: 'Conteúdo',
		onThisPage: 'Nesta página',
		previous: 'Anterior',
		next: 'Próxima',
		open: 'Abrir o Moneta',
		language: 'Idioma',
		skip: 'Pular para o conteúdo',
		languageName: 'Português (BR)'
	}
};

/** The page's own policy: nothing but its stylesheet and images, all from this origin. */
export const GUIDE_CSP =
	"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'";

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** A heading's text as an id: lower case, accents dropped, words joined by hyphens. */
export function slugify(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

const EXPLICIT_ID = /\s*\{#([a-z0-9-]+)\}\s*$/;
const PAGE_LINK = /^([a-z-]+)\.md(?:#([a-z0-9-]+))?$/;

/**
 * Parses one page. Headings take the id written after them (`## Carryover {#carryover}`), which
 * the app links to and which stays the same in every language, or else one made from their text.
 * Links to `other.md#id` and images in `img/` become addresses under `/guide/`. An image named
 * `…-light.…` also shows its `…-dark.…` twin to readers in dark mode.
 */
export function parsePage(locale: GuideLocale, slug: GuidePage, markdown: string): ParsedPage {
	const headings: Heading[] = [];
	const links: string[] = [];
	const images: string[] = [];
	let title: string | undefined;
	const marked = new Marked({ gfm: true });
	marked.use({
		walkTokens(token) {
			if (token.type === 'link') {
				const match = PAGE_LINK.exec(token.href);
				if (!match) return;
				const page = match[1] as GuidePage;
				if (!GUIDE_PAGES.includes(page)) throw new Error(`${locale}/${slug}: no page ${page}`);
				links.push(match[2] ? `${page}#${match[2]}` : page);
				token.href = guidePath(locale, page, match[2]);
			} else if (token.type === 'image' && token.href.startsWith('img/')) {
				const name = token.href.slice('img/'.length);
				images.push(name);
				if (darkTwin(name)) images.push(darkTwin(name)!);
				token.href = `/guide/${token.href}`;
			}
		},
		renderer: {
			heading({ tokens, depth }: Tokens.Heading) {
				let html = this.parser.parseInline(tokens);
				const explicit = EXPLICIT_ID.exec(html);
				html = html.replace(EXPLICIT_ID, '');
				const text = html.replace(/<[^>]+>/g, '');
				if (depth === 1) {
					if (title !== undefined) throw new Error(`${locale}/${slug}: more than one title`);
					title = text;
					return '';
				}
				const id = explicit?.[1] ?? slugify(text);
				if (headings.some((h) => h.id === id)) {
					throw new Error(`${locale}/${slug}: two headings with the id ${id}`);
				}
				headings.push({ id, text, depth });
				return `<h${depth} id="${id}"><a class="anchor" href="#${id}">${html}</a></h${depth}>\n`;
			},
			image({ href, text }: Tokens.Image) {
				// Screenshots are taken at twice the size they are meant to show (`2x`).
				const src = escapeHtml(href);
				const img = `<img src="${src}" srcset="${src} 2x" alt="${escapeHtml(text)}" loading="lazy" />`;
				const dark = darkTwin(href);
				if (!dark) return img;
				const source = `<source media="(prefers-color-scheme: dark)" srcset="${escapeHtml(dark)} 2x" />`;
				return `<picture>${source}${img}</picture>`;
			},
			link({ href, title: linkTitle, tokens }: Tokens.Link) {
				const text = this.parser.parseInline(tokens);
				const external = /^https?:/.test(href);
				const attrs = [
					`href="${escapeHtml(href)}"`,
					linkTitle ? `title="${escapeHtml(linkTitle)}"` : '',
					external ? 'rel="noopener noreferrer"' : ''
				].filter(Boolean);
				return `<a ${attrs.join(' ')}>${text}</a>`;
			}
		}
	});
	const body = marked.parse(markdown, { async: false });
	if (title === undefined) throw new Error(`${locale}/${slug}: no # title`);
	return { locale, slug, title, body, headings, links, images };
}

/** `x-light.png` → `x-dark.png` (also `x-light.pt-BR.png`); null for an image without a theme. */
export function darkTwin(name: string): string | null {
	const match = /^(.*)-light(\.[^/]*)$/.exec(name);
	return match ? `${match[1]}-dark${match[2]}` : null;
}

/** Throws when a page links to a heading that isn't there, in any language. */
export function checkLinks(pages: ParsedPage[]): void {
	for (const page of pages) {
		for (const link of page.links) {
			const [slug, anchor] = link.split('#');
			const target = pages.find((p) => p.locale === page.locale && p.slug === slug);
			if (!target) throw new Error(`${page.locale}/${page.slug}: no page ${slug}`);
			if (anchor && !target.headings.some((h) => h.id === anchor)) {
				throw new Error(`${page.locale}/${page.slug}: no #${anchor} on ${slug}`);
			}
		}
	}
}

/** The full HTML document of `page`; `pages` are every page in its language, in order. */
export function renderPage(page: ParsedPage, pages: ParsedPage[]): string {
	const words = CHROME[page.locale];
	const index = pages.findIndex((p) => p.slug === page.slug);
	const previous = pages[index - 1];
	const next = pages[index + 1];
	const href = (p: ParsedPage) => guidePath(p.locale, p.slug);
	const title = page.slug === 'index' ? words.guide : `${page.title} · ${words.guide}`;

	const nav = pages
		.map((p) => {
			const current = p.slug === page.slug ? ' aria-current="page"' : '';
			return `<li><a href="${href(p)}"${current}>${p.title}</a></li>`;
		})
		.join('');
	const languages = GUIDE_LOCALES.map((locale) => {
		const current = locale === page.locale ? ' aria-current="true"' : '';
		return `<a href="${guidePath(locale, page.slug)}" hreflang="${locale}" lang="${locale}"${current}>${CHROME[locale].languageName}</a>`;
	}).join('');
	const sections = page.headings.filter((h) => h.depth === 2);
	const toc =
		sections.length >= 3
			? `<nav class="toc" aria-label="${words.onThisPage}"><p>${words.onThisPage}</p><ul>${sections
					.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
					.join('')}</ul></nav>`
			: '';
	const pager = [
		previous
			? `<a class="prev" href="${href(previous)}"><span>${words.previous}</span>${previous.title}</a>`
			: '<span></span>',
		next ? `<a class="next" href="${href(next)}"><span>${words.next}</span>${next.title}</a>` : ''
	].join('');

	return `<!doctype html>
<html lang="${page.locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="content-security-policy" content="${GUIDE_CSP}" />
<meta name="color-scheme" content="light dark" />
<title>${title}</title>
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/guide/guide.css" />
${GUIDE_LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${guidePath(l, page.slug)}" />`).join('\n')}
</head>
<body>
<a class="skip" href="#content">${words.skip}</a>
<header class="top">
<a class="brand" href="${guidePath(page.locale)}"><img src="/icon.svg" alt="" width="28" height="28" />${words.guide}</a>
<a class="open" href="/">${words.open}</a>
</header>
<div class="layout">
<aside>
<details class="contents phone">
<summary>${words.contents}</summary>
<ol>${nav}</ol>
</details>
<nav class="contents desktop" aria-label="${words.contents}"><ol>${nav}</ol></nav>
<div class="languages" role="group" aria-label="${words.language}">${languages}</div>
</aside>
<main id="content">
<h1>${page.title}</h1>
${toc}
${page.body}
<nav class="pager">${pager}</nav>
</main>
</div>
</body>
</html>
`;
}
