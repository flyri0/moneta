import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { watchForUpdates, type UpdateRegistration } from './update-checks';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function setup(options: { interval?: number; minGap?: number } = {}) {
	const registration = {
		installing: null as unknown,
		update: vi.fn(async () => {})
	} satisfies UpdateRegistration;
	const win = new EventTarget();
	const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as string });
	const nav = { onLine: true };
	const stop = watchForUpdates(registration, { win, doc, nav, ...options });
	const show = (state: string) => {
		doc.visibilityState = state;
		doc.dispatchEvent(new Event('visibilitychange'));
	};
	return { registration, win, doc, nav, stop, show };
}

describe('watchForUpdates', () => {
	beforeEach(() => void vi.useFakeTimers());
	afterEach(() => void vi.useRealTimers());

	it('checks every hour', () => {
		const { registration } = setup();
		expect(registration.update).not.toHaveBeenCalled();
		vi.advanceTimersByTime(HOUR);
		expect(registration.update).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(HOUR);
		expect(registration.update).toHaveBeenCalledTimes(2);
	});

	it('checks when the app comes back into view', () => {
		const { registration, show } = setup();
		show('hidden');
		expect(registration.update).not.toHaveBeenCalled();
		show('visible');
		expect(registration.update).toHaveBeenCalledTimes(1);
	});

	it('checks when the connection comes back', () => {
		const { registration, win } = setup();
		win.dispatchEvent(new Event('online'));
		expect(registration.update).toHaveBeenCalledTimes(1);
	});

	it('skips the check while offline', () => {
		const { registration, nav, show } = setup();
		nav.onLine = false;
		show('visible');
		vi.advanceTimersByTime(HOUR);
		expect(registration.update).not.toHaveBeenCalled();
	});

	it('skips the check while a new version is already installing', () => {
		const { registration, show } = setup();
		registration.installing = {};
		show('visible');
		expect(registration.update).not.toHaveBeenCalled();
	});

	it('checks at most once a minute', () => {
		const { registration, win, show } = setup();
		show('visible');
		win.dispatchEvent(new Event('online'));
		show('visible');
		expect(registration.update).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(MINUTE);
		show('visible');
		expect(registration.update).toHaveBeenCalledTimes(2);
	});

	it('ignores a failed check', async () => {
		const { registration, show } = setup();
		registration.update.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		show('visible');
		await vi.runAllTicks();
		expect(registration.update).toHaveBeenCalledTimes(1);
	});

	it('stops watching', () => {
		const { registration, win, stop, show } = setup();
		stop();
		show('visible');
		win.dispatchEvent(new Event('online'));
		vi.advanceTimersByTime(HOUR);
		expect(registration.update).not.toHaveBeenCalled();
	});
});
