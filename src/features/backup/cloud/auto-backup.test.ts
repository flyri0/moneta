import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DomainError } from '$domain/errors';
import {
	autoBackup,
	QUIET_MS,
	RETRY_MS,
	START_DELAY_MS,
	STALE_MS,
	type AutoBackupStatus,
	type BackupProgress
} from './auto-backup';

const START = Date.parse('2026-09-26T12:00:00.000Z');

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

function setup(saved: Partial<BackupProgress> = {}) {
	let progress: BackupProgress = {
		lastUploadAt: new Date(START - 60_000).toISOString(),
		pendingSince: null,
		...saved
	};
	const statuses: AutoBackupStatus[] = [];
	let finish: (() => void) | null = null;
	const run = vi.fn(async () => {});
	const auto = autoBackup({
		run,
		progress: {
			load: () => progress,
			save: (next) => (progress = next)
		},
		onStatus: (s) => statuses.push(s)
	});
	return {
		auto,
		run,
		statuses,
		progress: () => progress,
		/** Makes the next run wait until `release` is called. */
		hold() {
			run.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
			return () => finish?.();
		}
	};
}

describe('autoBackup', () => {
	it('backs up a while after start when the last backup is a day old', async () => {
		const { auto, run } = setup({ lastUploadAt: new Date(START - STALE_MS).toISOString() });
		auto.start();
		await vi.advanceTimersByTimeAsync(START_DELAY_MS - 1);
		expect(run).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledOnce();
	});

	it('backs up at start when a change was left waiting, or none was ever made', async () => {
		for (const saved of [
			{ pendingSince: new Date(START - 1000).toISOString() },
			{ lastUploadAt: null }
		]) {
			const { auto, run } = setup(saved);
			auto.start();
			await vi.advanceTimersByTimeAsync(START_DELAY_MS);
			expect(run).toHaveBeenCalledOnce();
			auto.stop();
		}
	});

	it('does nothing at start when the last backup is recent', async () => {
		const { auto, run } = setup();
		auto.start();
		await vi.advanceTimersByTimeAsync(STALE_MS);
		expect(run).not.toHaveBeenCalled();
	});

	it('backs up once changes have been quiet for a while, and records it', async () => {
		const { auto, run, progress } = setup();
		auto.start();
		auto.changed(['transactions']);
		expect(progress().pendingSince).toBe(new Date(START).toISOString());
		await vi.advanceTimersByTimeAsync(QUIET_MS - 1000);
		auto.changed(['transactions']);
		await vi.advanceTimersByTimeAsync(QUIET_MS - 1);
		expect(run).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledOnce();
		expect(progress()).toEqual({
			lastUploadAt: new Date(Date.now()).toISOString(),
			pendingSince: null
		});
	});

	it('backs up at once when the page is hidden with a change waiting', async () => {
		const { auto, run } = setup();
		auto.start();
		auto.flush();
		expect(run).not.toHaveBeenCalled();
		auto.changed(['transactions']);
		auto.flush();
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledOnce();
	});

	it('ignores its own record of the backup, but not other changes made meanwhile', async () => {
		const { auto, run, hold, progress } = setup();
		auto.start();
		auto.changed(['transactions']);
		const release = hold();
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		// markBackedUp writes meta while the run is going.
		auto.changed(['meta']);
		release();
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		expect(run).toHaveBeenCalledOnce();
		expect(progress().pendingSince).toBeNull();

		const again = hold();
		auto.changed(['transactions']);
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		auto.changed(['transactions']);
		again();
		await vi.advanceTimersByTimeAsync(0);
		expect(progress().pendingSince).not.toBeNull();
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		expect(run).toHaveBeenCalledTimes(3);
		expect(progress().pendingSince).toBeNull();
	});

	it('never runs two backups at once', async () => {
		const { auto, run, hold } = setup();
		auto.start();
		const release = hold();
		const first = auto.runNow();
		const second = auto.runNow();
		expect(run).toHaveBeenCalledOnce();
		release();
		await Promise.all([first, second]);
		expect(run).toHaveBeenCalledOnce();
	});

	it('retries an outage later, and at once when back online', async () => {
		const { auto, run, statuses } = setup();
		auto.start();
		run.mockRejectedValue(new DomainError('CLOUD_UNAVAILABLE'));
		auto.changed(['transactions']);
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		expect(statuses.at(-1)).toMatchObject({ kind: 'failed', retrying: true });
		await vi.advanceTimersByTimeAsync(RETRY_MS[0]);
		expect(run).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(RETRY_MS[1]);
		expect(run).toHaveBeenCalledTimes(3);
		run.mockResolvedValue();
		auto.online();
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(4);
		expect(statuses.at(-1)).toEqual({ kind: 'idle' });
	});

	it('pauses when the user has to act, until resumed', async () => {
		const { auto, run, statuses } = setup();
		auto.start();
		run.mockRejectedValueOnce(new DomainError('CLOUD_AUTH_NEEDED'));
		auto.changed(['transactions']);
		await vi.advanceTimersByTimeAsync(QUIET_MS);
		expect(statuses.at(-1)).toMatchObject({ kind: 'failed', retrying: false });
		auto.changed(['transactions']);
		auto.online();
		auto.flush();
		await vi.advanceTimersByTimeAsync(RETRY_MS.at(-1)! * 2);
		expect(run).toHaveBeenCalledOnce();
		auto.resume();
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('reports a manual run’s failure to the caller', async () => {
		const { auto, run } = setup();
		auto.start();
		run.mockRejectedValueOnce(new DomainError('CLOUD_STORAGE_FULL'));
		await expect(auto.runNow()).rejects.toMatchObject({ code: 'CLOUD_STORAGE_FULL' });
	});

	it('stops listening once stopped', async () => {
		const { auto, run } = setup({ lastUploadAt: null });
		auto.start();
		auto.changed(['transactions']);
		auto.stop();
		auto.flush();
		auto.online();
		await vi.advanceTimersByTimeAsync(STALE_MS);
		expect(run).not.toHaveBeenCalled();
	});
});
