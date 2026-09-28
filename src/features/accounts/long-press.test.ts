import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, LONG_PRESS_SLOP, LongPress } from './long-press';

describe('LongPress', () => {
	let fired: ReturnType<typeof vi.fn<() => void>>;
	let press: LongPress;

	beforeEach(() => {
		vi.useFakeTimers();
		fired = vi.fn<() => void>();
		press = new LongPress(fired);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fires after holding still, and swallows the click that follows once', () => {
		press.down(10, 10);
		vi.advanceTimersByTime(LONG_PRESS_MS - 1);
		expect(fired).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fired).toHaveBeenCalledOnce();
		expect(press.takeFired()).toBe(true);
		expect(press.takeFired()).toBe(false);
	});

	it('tolerates a small wobble', () => {
		press.down(10, 10);
		press.move(10 + LONG_PRESS_SLOP, 10);
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(fired).toHaveBeenCalledOnce();
	});

	it('gives up when the finger moves away, as in a scroll', () => {
		press.down(10, 10);
		press.move(10, 10 + LONG_PRESS_SLOP + 1);
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(fired).not.toHaveBeenCalled();
		expect(press.takeFired()).toBe(false);
	});

	it('gives up when released early', () => {
		press.down(10, 10);
		vi.advanceTimersByTime(LONG_PRESS_MS - 100);
		press.cancel();
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(fired).not.toHaveBeenCalled();
	});

	it('forgets a fired press when a new one starts', () => {
		press.down(10, 10);
		vi.advanceTimersByTime(LONG_PRESS_MS);
		press.down(10, 10);
		press.cancel();
		expect(press.takeFired()).toBe(false);
	});
});
