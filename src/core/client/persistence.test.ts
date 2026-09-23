import { describe, it, expect, vi } from 'vitest';
import {
	browserAsks,
	permissionStatus,
	persistQuietly,
	persistence,
	readPersistence
} from './persistence';

const UA = {
	chrome:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
	macSafari:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
	firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
	firefoxIos:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15'
};

function storage(persisted: boolean, grants = false) {
	return {
		persisted: vi.fn(async () => persisted),
		persist: vi.fn(async () => grants)
	};
}

describe('browserAsks', () => {
	it('is true for Firefox, which prompts the user', () => {
		expect(browserAsks(UA.firefox)).toBe(true);
		expect(browserAsks(UA.firefoxAndroid)).toBe(true);
	});

	it('is false where the browser decides by itself', () => {
		expect(browserAsks(UA.chrome)).toBe(false);
		expect(browserAsks(UA.edge)).toBe(false);
		expect(browserAsks(UA.macSafari)).toBe(false);
		// Firefox on iOS is WebKit underneath.
		expect(browserAsks(UA.firefoxIos)).toBe(false);
	});
});

describe('persistence', () => {
	it.each([
		[null, null, false, 'unsupported'],
		[true, 'granted', true, 'persisted'],
		// Firefox keeps the data persistent when the permission is cleared, until the data goes.
		[true, 'prompt', true, 'persisted'],
		[true, null, false, 'persisted'],
		[false, 'denied', true, 'blocked'],
		[false, 'prompt', true, 'ask'],
		[false, 'prompt', false, 'automatic'],
		[false, null, false, 'automatic']
	] as const)(
		'persisted %s, permission %s, asks %s: %s',
		(persisted, permission, asks, expected) => {
			expect(persistence(persisted, permission, asks)).toBe(expected);
		}
	);
});

describe('permissionStatus', () => {
	it('returns the persistent-storage permission', async () => {
		const status = { state: 'prompt' } as PermissionStatus;
		const query = vi.fn(async () => status);
		expect(await permissionStatus({ query })).toBe(status);
		expect(query).toHaveBeenCalledWith({ name: 'persistent-storage' });
	});

	it('is null where the permission is unknown (Safari) or there is no Permissions API', async () => {
		const query = vi.fn(async () => {
			throw new TypeError('unknown permission');
		});
		expect(await permissionStatus({ query })).toBeNull();
		expect(await permissionStatus(undefined)).toBeNull();
	});
});

describe('readPersistence', () => {
	it('is unsupported without the Storage API', async () => {
		expect(await readPersistence(undefined, null, UA.chrome)).toBe('unsupported');
		expect(await readPersistence({}, null, UA.chrome)).toBe('unsupported');
	});

	it('is unsupported when persisted() fails', async () => {
		const failing = {
			persisted: async () => {
				throw new Error('no');
			}
		};
		expect(await readPersistence(failing, null, UA.chrome)).toBe('unsupported');
	});

	it('combines persisted(), the permission and the browser', async () => {
		expect(await readPersistence(storage(true), null, UA.macSafari)).toBe('persisted');
		expect(await readPersistence(storage(false), { state: 'denied' }, UA.firefox)).toBe('blocked');
		expect(await readPersistence(storage(false), { state: 'prompt' }, UA.firefox)).toBe('ask');
		expect(await readPersistence(storage(false), { state: 'prompt' }, UA.chrome)).toBe('automatic');
	});
});

describe('persistQuietly', () => {
	it('asks browsers that decide without a prompt', async () => {
		const s = storage(false, true);
		await persistQuietly(s, UA.chrome);
		expect(s.persist).toHaveBeenCalledOnce();
	});

	it('never asks Firefox, which would show a prompt', async () => {
		const s = storage(false, true);
		await persistQuietly(s, UA.firefox);
		expect(s.persist).not.toHaveBeenCalled();
	});

	it('ignores a missing or failing API', async () => {
		await expect(persistQuietly(undefined, UA.chrome)).resolves.toBeUndefined();
		const failing = {
			persist: async () => {
				throw new Error('no');
			}
		};
		await expect(persistQuietly(failing, UA.chrome)).resolves.toBeUndefined();
	});
});
