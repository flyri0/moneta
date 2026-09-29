import { scrollLimits } from '$features/budget/sortable.svelte';

/**
 * Brings a report's drill-down into view below `lg`, where it opens under the whole table rather
 * than beside it, and moves focus to its heading (which needs `tabindex="-1"`).
 */
export function revealBelowTable(section: HTMLElement): void {
	if (matchMedia('(min-width: 1024px)').matches) return;
	// Clear of the sticky header, which would otherwise cover the heading.
	section.style.scrollMarginTop = `${Math.ceil(scrollLimits().top) + 12}px`;
	const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	section.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
	section.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
}
