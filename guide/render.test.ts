import { describe, expect, it } from 'vitest';
import {
	checkLinks,
	darkTwin,
	escapeHtml,
	GUIDE_CSP,
	parsePage,
	renderPage,
	slugify
} from './render';

describe('slugify', () => {
	it('drops accents and joins words with hyphens', () => {
		expect(slugify('Pronto para atribuir: o básico!')).toBe('pronto-para-atribuir-o-basico');
	});
});

describe('parsePage', () => {
	it('takes the # heading as the title, out of the body', () => {
		const page = parsePage('en', 'budgeting', '# How it works\n\nSome text.');
		expect(page.title).toBe('How it works');
		expect(page.body).not.toContain('<h1');
		expect(page.body).toContain('<p>Some text.</p>');
	});

	it('gives headings their written id, or one made from their text', () => {
		const page = parsePage(
			'en',
			'budgeting',
			'# T\n\n## Ready to Assign {#ready-to-assign}\n\n### Moving money'
		);
		expect(page.headings).toEqual([
			{ id: 'ready-to-assign', text: 'Ready to Assign', depth: 2 },
			{ id: 'moving-money', text: 'Moving money', depth: 3 }
		]);
		expect(page.body).toContain(
			'<h2 id="ready-to-assign"><a class="anchor" href="#ready-to-assign">Ready to Assign</a></h2>'
		);
	});

	it('refuses two headings with the same id', () => {
		expect(() => parsePage('en', 'faq', '# T\n\n## A {#x}\n\n## B {#x}')).toThrow('two headings');
	});

	it('refuses a page without a title', () => {
		expect(() => parsePage('en', 'faq', '## Only a section')).toThrow('no # title');
	});

	it('turns links to other pages into guide addresses in the same language', () => {
		const page = parsePage('pt-BR', 'index', '# T\n\n[a](budgeting.md#carryover) [b](index.md)');
		expect(page.body).toContain('href="/guide/pt-BR/budgeting/#carryover"');
		expect(page.body).toContain('href="/guide/pt-BR/"');
		expect(page.links).toEqual(['budgeting#carryover', 'index']);
	});

	it('refuses a link to a page that does not exist', () => {
		expect(() => parsePage('en', 'index', '# T\n\n[a](nowhere.md)')).toThrow('no page nowhere');
	});

	it('serves images from the guide and lists them', () => {
		const page = parsePage('en', 'index', '# T\n\n![A budget](img/budget-light.png)');
		expect(page.body).toContain('src="/guide/img/budget-light.png"');
		expect(page.images).toEqual(['budget-light.png', 'budget-dark.png']);
	});

	it('shows the dark twin of a -light image in dark mode, and lists both', () => {
		const page = parsePage('pt-BR', 'index', '# T\n\n![Import](img/import-light.pt-BR.png)');
		expect(page.body).toContain(
			'<picture><source media="(prefers-color-scheme: dark)" srcset="/guide/img/import-dark.pt-BR.png 2x" /><img src="/guide/img/import-light.pt-BR.png" srcset="/guide/img/import-light.pt-BR.png 2x" alt="Import" loading="lazy" /></picture>'
		);
		expect(page.images).toEqual(['import-light.pt-BR.png', 'import-dark.pt-BR.png']);
	});

	it('keeps external links from passing on the page they came from', () => {
		const page = parsePage('en', 'faq', '# T\n\n[GitHub](https://github.com)');
		expect(page.body).toContain(
			'<a href="https://github.com" rel="noopener noreferrer">GitHub</a>'
		);
	});
});

describe('checkLinks', () => {
	it('fails on a link to a heading that is not there', () => {
		const pages = [
			parsePage('en', 'index', '# A\n\n[x](budgeting.md#missing)'),
			parsePage('en', 'budgeting', '# B\n\n## Here {#here}')
		];
		expect(() => checkLinks(pages)).toThrow('no #missing on budgeting');
	});

	it('passes when every link lands on a heading', () => {
		const pages = [
			parsePage('en', 'index', '# A\n\n[x](budgeting.md#here)'),
			parsePage('en', 'budgeting', '# B\n\n## Here {#here}')
		];
		expect(() => checkLinks(pages)).not.toThrow();
	});
});

describe('renderPage', () => {
	const pages = [
		parsePage('en', 'index', '# Getting started\n\nHello.'),
		parsePage('en', 'budgeting', '# Budgets & *goals*\n\n## A\n\n## B\n\n## C')
	];

	it('ships its own restrictive policy and stylesheet', () => {
		const html = renderPage(pages[0], pages);
		expect(html).toContain(`content="${GUIDE_CSP}"`);
		expect(html).toContain('<link rel="stylesheet" href="/guide/guide.css" />');
		expect(html).not.toContain('<script');
	});

	it('marks the current page and links the other language', () => {
		const html = renderPage(pages[1], pages);
		expect(html).toContain('<a href="/guide/budgeting/" aria-current="page">');
		expect(html).toContain('href="/guide/pt-BR/budgeting/" hreflang="pt-BR"');
	});

	it('puts titles in the page as escaped text', () => {
		const html = renderPage(pages[1], pages);
		expect(html).toContain('<title>Budgets &amp; goals · Moneta guide</title>');
	});

	it('lists the sections of a long page, and links the pages around it', () => {
		const html = renderPage(pages[1], pages);
		expect(html).toContain('<nav class="toc" aria-label="On this page">');
		expect(html).toContain('<a class="prev" href="/guide/">');
		expect(renderPage(pages[0], pages)).not.toContain('class="toc"');
	});
});

describe('darkTwin', () => {
	it('names the dark version of a light image, in any language', () => {
		expect(darkTwin('budget-light.png')).toBe('budget-dark.png');
		expect(darkTwin('budget-light.pt-BR.png')).toBe('budget-dark.pt-BR.png');
		expect(darkTwin('phone.png')).toBeNull();
	});
});

describe('escapeHtml', () => {
	it('escapes what could break out of text or an attribute', () => {
		expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
		);
	});
});
