import { describe, it, expect, vi, afterEach } from 'vitest';
import { settleWithin } from './timeout';

afterEach(() => {
	vi.useRealTimers();
});

describe('settleWithin', () => {
	it('resolves as soon as the promise settles', async () => {
		await expect(settleWithin(Promise.resolve('x'), 60_000)).resolves.toBeUndefined();
		await expect(settleWithin(Promise.reject(new Error('no')), 60_000)).resolves.toBeUndefined();
	});

	it('gives up on a promise that never settles once the time is up', async () => {
		vi.useFakeTimers();
		let done = false;
		void settleWithin(new Promise(() => {}), 3000).then(() => (done = true));
		await vi.advanceTimersByTimeAsync(2999);
		expect(done).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(done).toBe(true);
	});
});
