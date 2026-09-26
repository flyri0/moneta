import { describe, expect, it } from 'vitest';
import { runWhenIdle } from './idle';

/** A scheduler the test drives: `tick()` runs the one waiting callback. */
function manual() {
	let waiting: (() => void) | null = null;
	return {
		schedule: (run: () => void) => {
			waiting = run;
			return () => (waiting = null);
		},
		pending: () => waiting !== null,
		async tick() {
			const run = waiting;
			waiting = null;
			run?.();
			// Let an async task settle before the next one is scheduled.
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	};
}

describe('runWhenIdle', () => {
	it('runs one task per idle period, in order', async () => {
		const idle = manual();
		const ran: number[] = [];
		runWhenIdle([() => ran.push(1), () => ran.push(2)], idle.schedule);
		expect(ran).toEqual([]);
		await idle.tick();
		expect(ran).toEqual([1]);
		await idle.tick();
		expect(ran).toEqual([1, 2]);
		expect(idle.pending()).toBe(false);
	});

	it('waits for an async task before scheduling the next', async () => {
		const idle = manual();
		let finish = () => {};
		const ran: string[] = [];
		runWhenIdle(
			[() => new Promise<void>((resolve) => (finish = resolve)), () => ran.push('second')],
			idle.schedule
		);
		await idle.tick();
		expect(idle.pending()).toBe(false);
		finish();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await idle.tick();
		expect(ran).toEqual(['second']);
	});

	it('carries on past a task that fails', async () => {
		const idle = manual();
		const ran: string[] = [];
		runWhenIdle(
			[
				() => Promise.reject(new Error('offline')),
				() => {
					throw new Error('sync');
				},
				() => ran.push('last')
			],
			idle.schedule
		);
		await idle.tick();
		await idle.tick();
		await idle.tick();
		expect(ran).toEqual(['last']);
	});

	it('runs nothing more once stopped', async () => {
		const idle = manual();
		const ran: number[] = [];
		const stop = runWhenIdle([() => ran.push(1), () => ran.push(2)], idle.schedule);
		await idle.tick();
		stop();
		expect(idle.pending()).toBe(false);
		await idle.tick();
		expect(ran).toEqual([1]);
	});
});
