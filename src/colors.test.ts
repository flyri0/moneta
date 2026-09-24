import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('.', import.meta.url).pathname;

/** Every source file that can carry a colour, minus generated code and tests. */
function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return path.endsWith(join('i18n', 'paraglide')) ? [] : sources(path);
		if (!/\.(svelte|ts|css)$/.test(entry.name) || entry.name.endsWith('.test.ts')) return [];
		return [path];
	});
}

/** Hex literals, colour functions and arbitrary Tailwind colours like `bg-[#fff]`. */
const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(|-\[#/gi;

describe('colours', () => {
	it('come from the Tailwind palette, never from a literal', () => {
		const found = sources(root).flatMap((file) =>
			readFileSync(file, 'utf8')
				.split('\n')
				.flatMap((line, i) =>
					[...line.matchAll(LITERAL)].map(
						(match) => `${relative(root, file)}:${i + 1}: ${match[0]}`
					)
				)
		);
		expect(found).toEqual([]);
	});
});
