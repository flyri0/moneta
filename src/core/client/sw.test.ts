import { describe, it, expect, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }));

import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { createServiceWorker, type UpdateStatus } from './sw';

type FakeWorker = ReturnType<typeof fakeWorker>;

/** A fake service worker whose state can change. */
function fakeWorker(state: string) {
	return Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
}

/** A fake registration: its workers and `updatefound`, and `update()` answered by the test. */
function fakeRegistration({
	active = fakeWorker('activated') as FakeWorker | null,
	waiting = null as FakeWorker | null,
	installing = null as FakeWorker | null
} = {}) {
	return Object.assign(new EventTarget(), {
		active,
		waiting,
		installing,
		update: vi.fn(async (): Promise<unknown> => undefined)
	});
}

type FakeRegistration = ReturnType<typeof fakeRegistration>;

/** A service worker setup with a fake registerSW, clock, reload, container and document. */
function setup(
	registration: FakeRegistration | null = fakeRegistration(),
	{ controlled = true, registered = true } = {}
) {
	let options: RegisterSWOptions = {};
	const reload = vi.fn();
	const watch = vi.fn();
	const timers: { fn: () => void; ms: number }[] = [];
	const container = Object.assign(new EventTarget(), { controller: controlled ? {} : null });
	const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
	const sw = createServiceWorker({
		register: (o) => {
			options = o;
			if (registered)
				o.onRegisteredSW?.(
					'/sw.js',
					(registration ?? undefined) as unknown as ServiceWorkerRegistration | undefined
				);
			return async () => {};
		},
		reload,
		later: (fn, ms) => void timers.push({ fn, ms }),
		lookUp: async () => (registration ?? undefined) as ServiceWorkerRegistration | undefined,
		watch,
		container,
		doc
	});
	const statuses: UpdateStatus[] = [];
	sw.onUpdateStatus((s) => statuses.push(s));
	// Only the test without a registration passes null, and it never reads it.
	return {
		sw,
		registration: registration as FakeRegistration,
		watch,
		options: () => options,
		reload,
		timers,
		container,
		doc,
		statuses
	};
}

/** Moves a fake worker to `state`, as the browser would. */
function change(worker: FakeWorker, state: string) {
	worker.state = state;
	worker.dispatchEvent(new Event('statechange'));
}

/** The browser found a new version: it starts installing. */
function found(registration: FakeRegistration): FakeWorker {
	const worker = fakeWorker('installing');
	registration.installing = worker;
	registration.dispatchEvent(new Event('updatefound'));
	return worker;
}

/** The installing version finished installing and now waits. */
function installed(registration: FakeRegistration, worker: FakeWorker) {
	registration.installing = null;
	registration.waiting = worker;
	change(worker, 'installed');
}

/** The installing version failed. */
function failed(registration: FakeRegistration, worker: FakeWorker) {
	registration.installing = null;
	change(worker, 'redundant');
}

describe('createServiceWorker', () => {
	it('offers a version that was already waiting when the page registered', () => {
		const { statuses } = setup(fakeRegistration({ waiting: fakeWorker('installed') }));
		expect(statuses).toEqual(['idle', 'ready']);
	});

	it('shows a version that was still installing when the page registered, then offers it', () => {
		const installing = fakeWorker('installing');
		const { registration, statuses } = setup(fakeRegistration({ installing }));
		expect(statuses.at(-1)).toBe('downloading');
		installed(registration, installing);
		expect(statuses).toEqual(['idle', 'downloading', 'ready']);
	});

	it('follows a version installing before registering answers (it waits for the install)', async () => {
		const installing = fakeWorker('installing');
		const { registration, statuses } = setup(fakeRegistration({ installing }), {
			registered: false
		});
		await vi.waitFor(() => expect(statuses.at(-1)).toBe('downloading'));
		installed(registration, installing);
		expect(statuses).toEqual(['idle', 'downloading', 'ready']);
	});

	it('follows the registration once when both ways answer', async () => {
		const { watch } = setup();
		await Promise.resolve();
		expect(watch).toHaveBeenCalledTimes(1);
	});

	it('shows a version found later, then offers it', () => {
		const { registration, statuses } = setup();
		const worker = found(registration);
		expect(statuses.at(-1)).toBe('downloading');
		installed(registration, worker);
		expect(statuses).toEqual(['idle', 'downloading', 'ready']);
	});

	it('still offers a version found after one that failed to install', () => {
		const { registration, statuses } = setup();
		failed(registration, found(registration));
		expect(statuses).toEqual(['idle', 'downloading', 'idle']);
		installed(registration, found(registration));
		expect(statuses).toEqual(['idle', 'downloading', 'idle', 'downloading', 'ready']);
	});

	it('keeps offering the waiting version while a newer one installs', () => {
		const { registration, statuses } = setup(
			fakeRegistration({ waiting: fakeWorker('installed') })
		);
		const newer = found(registration);
		expect(statuses.at(-1)).toBe('ready');
		failed(registration, newer);
		expect(statuses).toEqual(['idle', 'ready']);
	});

	it("doesn't offer the first install", () => {
		const installing = fakeWorker('installing');
		const registration = fakeRegistration({ active: null, installing });
		const { statuses } = setup(registration, { controlled: false });
		installed(registration, installing);
		expect(statuses).toEqual(['idle']);
	});

	it('looks again when the app comes back into view', () => {
		const { registration, doc, statuses } = setup();
		// The page was frozen in the background and saw none of it.
		registration.waiting = fakeWorker('installed');
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(statuses).toEqual(['idle', 'ready']);
	});

	describe('checking by hand', () => {
		it('says the app is current when there is nothing new', async () => {
			const { sw, registration, statuses } = setup();
			await sw.check();
			expect(registration.update).toHaveBeenCalledTimes(1);
			expect(statuses).toEqual(['idle', 'checking', 'current']);
		});

		it('shows the download when it finds a version', async () => {
			const { sw, registration, statuses } = setup();
			registration.update.mockImplementation(async () => found(registration));
			await sw.check();
			expect(statuses).toEqual(['idle', 'checking', 'downloading']);
		});

		it('says the check failed when the host is out of reach', async () => {
			const { sw, registration, statuses } = setup();
			registration.update.mockRejectedValue(new TypeError('Failed to fetch'));
			await sw.check();
			expect(statuses).toEqual(['idle', 'checking', 'failed']);
		});

		it("doesn't ask again while a version is waiting", async () => {
			const { sw, registration } = setup(fakeRegistration({ waiting: fakeWorker('installed') }));
			await sw.check();
			expect(registration.update).not.toHaveBeenCalled();
		});

		it('fails without a registration', async () => {
			const { sw, statuses } = setup(null);
			await sw.check();
			expect(statuses).toEqual(['idle', 'failed']);
		});
	});

	describe('when a new version takes control', () => {
		it('lets the app shut down before the reload', () => {
			const { sw, container, reload } = setup();
			const shutDown = vi.fn();
			sw.onNeedReload(shutDown);
			container.dispatchEvent(new Event('controllerchange'));
			expect(shutDown).toHaveBeenCalledTimes(1);
			expect(reload).not.toHaveBeenCalled();
		});

		it('reloads by itself when the app gave no handler', () => {
			const { container, reload } = setup();
			container.dispatchEvent(new Event('controllerchange'));
			expect(reload).toHaveBeenCalledTimes(1);
		});

		it('reloads once when Workbox reports it too', () => {
			const { sw, options, container } = setup();
			const shutDown = vi.fn();
			sw.onNeedReload(shutDown);
			container.dispatchEvent(new Event('controllerchange'));
			options().onNeedReload!();
			expect(shutDown).toHaveBeenCalledTimes(1);
		});

		it("doesn't reload a page that had no service worker (the first install)", () => {
			const { container, reload } = setup(fakeRegistration({ active: null }), {
				controlled: false
			});
			container.dispatchEvent(new Event('controllerchange'));
			expect(reload).not.toHaveBeenCalled();
		});
	});

	it('activates the waiting version, and reloads anyway if nothing happens within 10 s', async () => {
		const waiting = fakeWorker('installed');
		const { sw, reload, timers } = setup(fakeRegistration({ waiting }), { registered: false });
		await vi.waitFor(() => expect(sw.status()).toBe('ready'));
		await sw.apply();
		expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
		expect(timers.map((t) => t.ms)).toEqual([10_000]);
		timers[0].fn();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('just reloads when no version is waiting any more', async () => {
		const { sw, reload, timers } = setup();
		await sw.apply();
		expect(timers).toEqual([]);
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
