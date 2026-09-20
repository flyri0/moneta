import { m } from '$lib/paraglide/messages';

/**
 * The accent colours a budget can be themed with: Tailwind palette colours, kept chromatic
 * so the choice is visible. `layout.css` holds a `[data-theme='<accent>']` block for each.
 */
export const ACCENTS = [
	'blue',
	'indigo',
	'violet',
	'cyan',
	'teal',
	'emerald',
	'amber',
	'orange',
	'rose',
	'pink'
] as const;

export type Accent = (typeof ACCENTS)[number];

/** Matches the PWA theme colour. The reports' charts follow whichever accent is picked. */
export const DEFAULT_ACCENT: Accent = 'teal';

export function isAccent(value: string | null | undefined): value is Accent {
	return ACCENTS.includes(value as Accent);
}

/** The accent mode-watcher has stored, or the default when it holds nothing we know. */
export function readAccent(stored: string | null | undefined): Accent {
	return isAccent(stored) ? stored : DEFAULT_ACCENT;
}

/**
 * Swatch colours for each accent, matching the shade `layout.css` uses for --primary in each
 * mode, so a swatch shows exactly what picking it does.
 * The class names are spelled out because Tailwind only emits utilities it finds in the source.
 */
export const ACCENT_SWATCH: Record<Accent, string> = {
	blue: 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black',
	indigo: 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-black',
	violet: 'bg-violet-600 text-white dark:bg-violet-400 dark:text-black',
	cyan: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-black',
	teal: 'bg-teal-600 text-white dark:bg-teal-400 dark:text-black',
	emerald: 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-black',
	amber: 'bg-amber-500 text-black dark:bg-amber-400 dark:text-black',
	orange: 'bg-orange-500 text-black dark:bg-orange-400 dark:text-black',
	rose: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-black',
	pink: 'bg-pink-600 text-white dark:bg-pink-400 dark:text-black'
};

const ACCENT_LABELS: Record<Accent, () => string> = {
	blue: m.color_blue,
	indigo: m.color_indigo,
	violet: m.color_violet,
	cyan: m.color_cyan,
	teal: m.color_teal,
	emerald: m.color_emerald,
	amber: m.color_amber,
	orange: m.color_orange,
	rose: m.color_rose,
	pink: m.color_pink
};

export function accentLabel(accent: Accent): string {
	return ACCENT_LABELS[accent]();
}
