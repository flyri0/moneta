import { cubicOut } from 'svelte/easing';
import {
	fade as svelteFade,
	fly as svelteFly,
	slide as svelteSlide,
	type FadeParams,
	type FlyParams,
	type SlideParams,
	type TransitionConfig
} from 'svelte/transition';
import { flip as svelteFlip, type FlipParams } from 'svelte/animate';
import type { AnimationConfig } from 'svelte/animate';

export const ANIMATIONS_KEY = 'moneta:animations';

export interface MotionStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
}

/**
 * Resolves whether animations are enabled given storage and prefers-reduced-motion.
 * If the user has explicitly set 'true' or 'false', that choice wins.
 * Otherwise, animations default to enabled unless prefers-reduced-motion is true.
 */
export function resolveAnimationsEnabled(
	storage: Pick<MotionStorage, 'getItem'> | null | undefined,
	prefersReducedMotion: boolean
): boolean {
	const stored = storage?.getItem(ANIMATIONS_KEY);
	if (stored === 'true') return true;
	if (stored === 'false') return false;
	return !prefersReducedMotion;
}

export type ChartMotionConfig =
	{ type: 'tween'; duration: number; easing: (t: number) => number } | 'none';

export class MotionState {
	#storage: MotionStorage | null;
	#explicit = $state<boolean | null>(null);
	#prefersReduced = $state<boolean>(false);

	constructor(storage?: MotionStorage | null) {
		this.#storage =
			storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;

		if (this.#storage) {
			const stored = this.#storage.getItem(ANIMATIONS_KEY);
			if (stored === 'true') this.#explicit = true;
			else if (stored === 'false') this.#explicit = false;
		}

		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			const query = window.matchMedia('(prefers-reduced-motion: reduce)');
			this.#prefersReduced = query.matches;
			query.addEventListener?.('change', (e) => {
				this.#prefersReduced = e.matches;
				this.#syncDom();
			});
		}

		this.#syncDom();
	}

	#syncDom() {
		if (typeof document !== 'undefined' && document.documentElement) {
			document.documentElement.dataset.animations = this.enabled ? 'true' : 'false';
		}
	}

	get enabled(): boolean {
		return this.#explicit !== null ? this.#explicit : !this.#prefersReduced;
	}

	get prefersReduced(): boolean {
		return this.#prefersReduced;
	}

	setEnabled(value: boolean) {
		this.#explicit = value;
		this.#storage?.setItem(ANIMATIONS_KEY, String(value));
		this.#syncDom();
	}

	setPrefersReducedForTesting(value: boolean) {
		this.#prefersReduced = value;
		this.#syncDom();
	}

	/**
	 * Layerchart motion prop: 250ms tween when enabled, 'none' when disabled.
	 */
	get chartMotion(): ChartMotionConfig {
		return this.enabled ? { type: 'tween', duration: 250, easing: cubicOut } : 'none';
	}
}

export const motion = new MotionState();

/**
 * Slide transition wrapper that respects user animation preferences.
 * When animations are disabled, finishes immediately (duration: 0).
 */
export function slide(node: Element, params?: SlideParams): TransitionConfig {
	if (!motion.enabled) return { duration: 0 };
	return svelteSlide(node, { duration: 200, easing: cubicOut, ...params });
}

/**
 * Fade transition wrapper that respects user animation preferences.
 * When animations are disabled, finishes immediately (duration: 0).
 */
export function fade(node: Element, params?: FadeParams): TransitionConfig {
	if (!motion.enabled) return { duration: 0 };
	return svelteFade(node, { duration: 150, easing: cubicOut, ...params });
}

/**
 * Fly transition wrapper that respects user animation preferences.
 * When animations are disabled, finishes immediately (duration: 0).
 */
export function fly(node: Element, params?: FlyParams): TransitionConfig {
	if (!motion.enabled) return { duration: 0 };
	return svelteFly(node, { duration: 200, easing: cubicOut, ...params });
}

/**
 * Flip animation wrapper that respects user animation preferences.
 * When animations are disabled, finishes immediately (duration: 0).
 */
export function flip(
	node: Element,
	fromTo: { from: DOMRect; to: DOMRect },
	params?: FlipParams
): AnimationConfig {
	if (!motion.enabled) return { duration: 0 };
	return svelteFlip(node, fromTo, { duration: 250, easing: cubicOut, ...params });
}
