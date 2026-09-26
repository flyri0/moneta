import type { KeyValueStore } from './registry';

/** The desktop sidebar's size: its width when expanded, kept while it is collapsed to icons. */
export interface SidebarState {
	width: number;
	collapsed: boolean;
}

/** The icons-only rail (4rem). */
export const RAIL_WIDTH = 64;
/** The narrowest expanded sidebar (13rem). */
export const MIN_WIDTH = 208;
/** The widest sidebar, as a share of the viewport. */
export const MAX_SHARE = 0.25;

export const DEFAULT_SIDEBAR: SidebarState = { width: 256, collapsed: false };

/** Where this device keeps the sidebar's size. */
export const SIDEBAR_KEY = 'moneta.sidebar';

export function maxWidth(viewport: number): number {
	return Math.max(MIN_WIDTH, Math.floor(viewport * MAX_SHARE));
}

export function clampWidth(width: number, viewport: number): number {
	return Math.round(Math.min(Math.max(width, MIN_WIDTH), maxWidth(viewport)));
}

/**
 * The size for a drag that puts the sidebar's edge at `x`. Past halfway from the narrowest
 * expanded width to the rail it snaps to the rail, keeping the width it had to come back to.
 */
export function dragTo(x: number, viewport: number, current: SidebarState): SidebarState {
	if (x < (RAIL_WIDTH + MIN_WIDTH) / 2) return { width: current.width, collapsed: true };
	return { width: clampWidth(x, viewport), collapsed: false };
}

/** The size after a keyboard step: narrowing past the minimum collapses, widening a rail expands. */
export function stepBy(current: SidebarState, delta: number, viewport: number): SidebarState {
	if (current.collapsed) {
		return delta > 0 ? { width: clampWidth(current.width, viewport), collapsed: false } : current;
	}
	// A width saved on a wider window steps from what is shown, not from what was saved.
	const width = clampWidth(current.width, viewport);
	if (width + delta < MIN_WIDTH) return { width, collapsed: true };
	return { width: clampWidth(width + delta, viewport), collapsed: false };
}

export function readSidebar(store: KeyValueStore): SidebarState {
	try {
		const raw = JSON.parse(store.getItem(SIDEBAR_KEY) ?? 'null') as Partial<SidebarState> | null;
		if (typeof raw?.width === 'number' && typeof raw.collapsed === 'boolean') {
			return { width: raw.width, collapsed: raw.collapsed };
		}
	} catch {
		// Garbage or blocked storage: start from the default.
	}
	return DEFAULT_SIDEBAR;
}

export function writeSidebar(store: KeyValueStore, state: SidebarState): void {
	try {
		store.setItem(SIDEBAR_KEY, JSON.stringify(state));
	} catch {
		// Storage can be full or blocked; the sidebar just forgets its size.
	}
}
