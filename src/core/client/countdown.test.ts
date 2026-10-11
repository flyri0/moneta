import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from './countdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Countdown', () => {
	it('arms, counts down one second at a time, then is ready', () => {
		const changes: number[] = [];
		const c = new Countdown(3, (s) => changes.push(s.seconds));
		expect(c.ready).toBe(false);
		c.arm();
		expect(c).toMatchObject({ armed: true, seconds: 3, ready: false });
		vi.advanceTimersByTime(3000);
		expect(c).toMatchObject({ armed: true, seconds: 0, ready: true });
		expect(changes).toEqual([3, 2, 1, 0]);
	});

	it('stops when reset', () => {
		const c = new Countdown(5, () => {});
		c.arm();
		vi.advanceTimersByTime(2000);
		c.reset();
		vi.advanceTimersByTime(5000);
		expect(c).toMatchObject({ armed: false, seconds: 0, ready: false });
	});
});
