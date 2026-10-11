import { describe, expect, it, vi } from 'vitest';
import { oneAtATime } from './submit';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

describe('oneAtATime', () => {
	it('ignores calls while the previous one runs, then accepts the next', async () => {
		const gate = deferred();
		const handler = vi.fn(() => gate.promise);
		const states: boolean[] = [];
		const run = oneAtATime(handler, (p) => states.push(p));
		const first = run();
		void run();
		expect(handler).toHaveBeenCalledTimes(1);
		gate.resolve();
		await first;
		await run();
		expect(handler).toHaveBeenCalledTimes(2);
		expect(states).toEqual([true, false, true, false]);
	});

	it('prevents the default of an ignored submit, so the page never reloads', async () => {
		const gate = deferred();
		const handler = vi.fn((event: Event) => (void event, gate.promise));
		const run = oneAtATime(handler, () => {});
		void run(new Event('submit', { cancelable: true }));
		const second = new Event('submit', { cancelable: true });
		await run(second);
		expect(second.defaultPrevented).toBe(true);
		gate.resolve();
	});

	it('accepts a call again after the handler throws', async () => {
		const handler = vi.fn(async () => {
			throw new Error('boom');
		});
		const run = oneAtATime(handler, () => {});
		await expect(run()).rejects.toThrow('boom');
		await expect(run()).rejects.toThrow('boom');
		expect(handler).toHaveBeenCalledTimes(2);
	});
});
