import { describe, it, expect, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }));

import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { createServiceWorker } from './sw';

/** A service worker setup with a fake registerSW, clock and reload. */
function setup(waiting: boolean) {
	let options: RegisterSWOptions = {};
	const skipWaiting = vi.fn(async () => {});
	const reload = vi.fn();
	const timers: { fn: () => void; ms: number }[] = [];
	const sw = createServiceWorker({
		register: (o) => {
			options = o;
			o.onRegisteredSW?.('/sw.js', { waiting: waiting ? {} : null } as ServiceWorkerRegistration);
			return skipWaiting;
		},
		reload,
		later: (fn, ms) => void timers.push({ fn, ms }),
		watch: () => {}
	});
	return { sw, options: () => options, skipWaiting, reload, timers };
}

describe('createServiceWorker', () => {
	it('lets the app shut down before the reload a new version asks for', () => {
		const { sw, options, reload } = setup(true);
		const shutDown = vi.fn();
		sw.onNeedReload(shutDown);
		sw.ensure();
		options().onNeedReload!();
		expect(shutDown).toHaveBeenCalledTimes(1);
		expect(reload).not.toHaveBeenCalled();
	});

	it('reloads by itself when the app gave no handler', () => {
		const { sw, options, reload } = setup(true);
		sw.ensure();
		options().onNeedReload!();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('activates the waiting version, and reloads anyway if nothing happens within 10 s', async () => {
		const { sw, skipWaiting, reload, timers } = setup(true);
		sw.ensure();
		await sw.apply();
		expect(skipWaiting).toHaveBeenCalledWith(true);
		expect(timers.map((t) => t.ms)).toEqual([10_000]);
		timers[0].fn();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('just reloads when no version is waiting any more', async () => {
		const { sw, skipWaiting, reload } = setup(false);
		sw.ensure();
		await sw.apply();
		expect(skipWaiting).not.toHaveBeenCalled();
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
