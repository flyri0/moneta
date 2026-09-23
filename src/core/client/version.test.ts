import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_VERSION, LAST_VERSION_KEY, releaseUrl, takeUpdatedVersion } from './version';
import { brokenStore, memoryStore } from './testing';

describe('APP_VERSION', () => {
	it('is the version in package.json', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
		expect(APP_VERSION).toBe(pkg.version);
	});
});

describe('releaseUrl', () => {
	it('points at the GitHub release for the tag', () => {
		expect(releaseUrl('1.2.3')).toBe('https://github.com/flyri0/moneta/releases/tag/v1.2.3');
	});
});

describe('takeUpdatedVersion', () => {
	it('says nothing on the first run, and remembers the version', () => {
		const store = memoryStore();
		expect(takeUpdatedVersion(store, '1.0.0')).toBeNull();
		expect(store.getItem(LAST_VERSION_KEY)).toBe('1.0.0');
	});

	it('says nothing when the version is the same', () => {
		const store = memoryStore();
		store.setItem(LAST_VERSION_KEY, '1.0.0');
		expect(takeUpdatedVersion(store, '1.0.0')).toBeNull();
	});

	it('returns the new version once after an update', () => {
		const store = memoryStore();
		store.setItem(LAST_VERSION_KEY, '1.0.0');
		expect(takeUpdatedVersion(store, '1.1.0')).toBe('1.1.0');
		expect(takeUpdatedVersion(store, '1.1.0')).toBeNull();
	});

	it('says nothing when storage is blocked', () => {
		expect(takeUpdatedVersion(brokenStore(), '1.1.0')).toBeNull();
	});
});
