import { beforeAll, describe, expect, it } from 'vitest';
import {
	ANIMATIONS_KEY,
	fade,
	flip,
	fly,
	motion,
	MotionState,
	resolveAnimationsEnabled,
	slide,
	type MotionStorage
} from './motion.svelte';

class MemoryStorage implements MotionStorage {
	#map = new Map<string, string>();
	getItem(key: string): string | null {
		return this.#map.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.#map.set(key, value);
	}
	removeItem(key: string): void {
		this.#map.delete(key);
	}
}

beforeAll(() => {
	// Provide minimal mocks for Svelte transition calculations in Node environment
	if (typeof globalThis.getComputedStyle === 'undefined') {
		globalThis.getComputedStyle = (() => ({
			opacity: '1',
			overflow: 'visible',
			paddingTop: '0',
			paddingBottom: '0',
			marginTop: '0',
			marginBottom: '0',
			borderTopWidth: '0',
			borderBottomWidth: '0',
			height: '100px',
			transform: 'none',
			transformOrigin: '0px 0px',
			zoom: '1'
		})) as unknown as typeof getComputedStyle;
	}
});

describe('motion resolution', () => {
	it('defaults to true when storage is empty and prefers-reduced-motion is false', () => {
		const storage = new MemoryStorage();
		expect(resolveAnimationsEnabled(storage, false)).toBe(true);
	});

	it('defaults to false when storage is empty and prefers-reduced-motion is true', () => {
		const storage = new MemoryStorage();
		expect(resolveAnimationsEnabled(storage, true)).toBe(false);
	});

	it('respects explicit true even when prefers-reduced-motion is true', () => {
		const storage = new MemoryStorage();
		storage.setItem(ANIMATIONS_KEY, 'true');
		expect(resolveAnimationsEnabled(storage, true)).toBe(true);
	});

	it('respects explicit false even when prefers-reduced-motion is false', () => {
		const storage = new MemoryStorage();
		storage.setItem(ANIMATIONS_KEY, 'false');
		expect(resolveAnimationsEnabled(storage, false)).toBe(false);
	});
});

describe('MotionState', () => {
	it('reads initial preference from storage', () => {
		const storage = new MemoryStorage();
		storage.setItem(ANIMATIONS_KEY, 'false');
		const state = new MotionState(storage);
		expect(state.enabled).toBe(false);
		expect(state.chartMotion).toBe('none');
	});

	it('updates preference and persists to storage', () => {
		const storage = new MemoryStorage();
		const state = new MotionState(storage);
		expect(state.enabled).toBe(true);

		state.setEnabled(false);
		expect(state.enabled).toBe(false);
		expect(storage.getItem(ANIMATIONS_KEY)).toBe('false');
		expect(state.chartMotion).toBe('none');

		state.setEnabled(true);
		expect(state.enabled).toBe(true);
		expect(storage.getItem(ANIMATIONS_KEY)).toBe('true');
		expect(typeof state.chartMotion).toBe('object');
		if (typeof state.chartMotion === 'object') {
			expect(state.chartMotion.type).toBe('tween');
			expect(state.chartMotion.duration).toBe(250);
		}
	});

	it('transitions return duration 0 when motion is disabled', () => {
		motion.setEnabled(false);
		const el = { clientWidth: 10, clientHeight: 10, parentElement: null } as unknown as Element;

		const s = slide(el);
		expect(s.duration).toBe(0);

		const f = fade(el);
		expect(f.duration).toBe(0);

		const fl = fly(el);
		expect(fl.duration).toBe(0);

		const rect = {
			top: 0,
			left: 0,
			bottom: 10,
			right: 10,
			width: 10,
			height: 10,
			x: 0,
			y: 0,
			toJSON: () => {}
		};
		const an = flip(el, { from: rect, to: rect });
		expect(an.duration).toBe(0);

		// Reset motion back to enabled
		motion.setEnabled(true);
	});

	it('transitions return active duration when motion is enabled', () => {
		motion.setEnabled(true);
		const el = { clientWidth: 10, clientHeight: 10, parentElement: null } as unknown as Element;

		const s = slide(el);
		expect(s.duration).toBe(200);

		const f = fade(el);
		expect(f.duration).toBe(150);

		const fl = fly(el);
		expect(fl.duration).toBe(200);

		const rect = {
			top: 0,
			left: 0,
			bottom: 10,
			right: 10,
			width: 10,
			height: 10,
			x: 0,
			y: 0,
			toJSON: () => {}
		};
		const an = flip(el, { from: rect, to: rect });
		expect(an.duration).toBe(250);
	});
});
