import { describe, expect, it } from 'vitest';
import { GUIDE_LOCALES, GUIDE_PAGES, GUIDE_TOPICS } from '../src/core/client/guide';
import { loadGuide } from './build';

describe('the guide', async () => {
	// Fails on a missing page or a broken link between pages.
	const pages = await loadGuide();
	const ids = (locale: string, slug: string) =>
		pages.find((p) => p.locale === locale && p.slug === slug)!.headings.map((h) => h.id);

	it('has every page in every language', () => {
		expect(pages).toHaveLength(GUIDE_PAGES.length * GUIDE_LOCALES.length);
	});

	it('gives each page the same section ids in every language', () => {
		for (const slug of GUIDE_PAGES) {
			for (const locale of GUIDE_LOCALES.slice(1)) {
				// Sorted: a glossary's terms come in each language's alphabetical order.
				expect(ids(locale, slug).sort(), `${locale}/${slug}`).toEqual(ids('en', slug).sort());
			}
		}
	});

	it('has every section the app links to', () => {
		for (const [page, anchor] of Object.values(GUIDE_TOPICS)) {
			for (const locale of GUIDE_LOCALES) {
				expect(ids(locale, page), `${locale}/${page}`).toContain(anchor);
			}
		}
	});
});
