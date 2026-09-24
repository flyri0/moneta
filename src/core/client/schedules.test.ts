import { describe, it, expect, vi } from 'vitest';
import { scheduleRunner } from './schedules';

describe('scheduleRunner', () => {
	it('enters due occurrences once a day', async () => {
		let today = '2026-09-24';
		const enterDue = vi.fn(async () => 2);
		const run = scheduleRunner({ schedules: { enterDue } }, () => today);
		expect(await run()).toBe(2);
		expect(await run()).toBe(0);
		today = '2026-09-25';
		expect(await run()).toBe(2);
		expect(enterDue.mock.calls).toEqual([['2026-09-24'], ['2026-09-25']]);
	});

	it('tries again after a failure', async () => {
		const enterDue = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValue(1);
		const run = scheduleRunner({ schedules: { enterDue } }, () => '2026-09-24');
		await expect(run()).rejects.toThrow('busy');
		expect(await run()).toBe(1);
	});
});
