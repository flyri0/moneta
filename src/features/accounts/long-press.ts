import type { Attachment } from 'svelte/attachments';

/** How long a finger holds still before it counts as a long press, in ms. */
export const LONG_PRESS_MS = 450;
/** How far, in px, the finger may wander while holding. */
export const LONG_PRESS_SLOP = 8;

/**
 * The timing of a long press, apart from the DOM: `down` starts it, moving away or `cancel`
 * gives up, and holding for `LONG_PRESS_MS` calls `onPress`. A press that fired leaves a mark
 * so the click the browser sends on release can be swallowed (`takeFired`).
 */
export class LongPress {
	#onPress: () => void;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#origin: { x: number; y: number } | null = null;
	#fired = false;

	constructor(onPress: () => void) {
		this.#onPress = onPress;
	}

	/** Waiting for the press, or it fired and its click hasn't come yet. */
	get holding(): boolean {
		return this.#origin !== null || this.#fired;
	}

	down(x: number, y: number): void {
		this.reset();
		this.#origin = { x, y };
		this.#timer = setTimeout(() => {
			this.#origin = null;
			this.#fired = true;
			this.#onPress();
		}, LONG_PRESS_MS);
	}

	move(x: number, y: number): void {
		if (!this.#origin) return;
		if (Math.hypot(x - this.#origin.x, y - this.#origin.y) > LONG_PRESS_SLOP) this.cancel();
	}

	/** Stops waiting; a press that already fired keeps its mark. */
	cancel(): void {
		clearTimeout(this.#timer);
		this.#origin = null;
	}

	/** Stops waiting and forgets a press that fired. */
	reset(): void {
		this.cancel();
		this.#fired = false;
	}

	/** Whether the press fired, clearing the mark. */
	takeFired(): boolean {
		const fired = this.#fired;
		this.#fired = false;
		return fired;
	}
}

/**
 * Calls `onPress` when a finger or pen holds still on the element (a mouse never does), with a
 * short vibration where the device has one. The click that follows is swallowed, and so is the
 * context menu the browser would open.
 */
export function longPress(onPress: () => void): Attachment<HTMLElement> {
	return (node) => {
		const press = new LongPress(() => {
			navigator.vibrate?.(10);
			onPress();
		});
		const down = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' || !event.isPrimary) press.reset();
			else press.down(event.clientX, event.clientY);
		};
		const move = (event: PointerEvent) => press.move(event.clientX, event.clientY);
		const cancel = () => press.cancel();
		const click = (event: MouseEvent) => {
			if (!press.takeFired()) return;
			event.preventDefault();
			event.stopPropagation();
		};
		const menu = (event: Event) => {
			if (press.holding) event.preventDefault();
		};
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', cancel);
		node.addEventListener('pointercancel', cancel);
		node.addEventListener('click', click, true);
		node.addEventListener('contextmenu', menu);
		return () => {
			press.reset();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
		};
	};
}
