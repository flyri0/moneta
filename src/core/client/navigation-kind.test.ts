import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable } from 'svelte/store';
import { loadsSettled, navigationKind } from './navigation-kind';

describe('navigationKind', () => {
	it('does not animate within a screen, or without both ends', () => {
		expect(navigationKind('/budget/[month]', '/budget/[month]')).toBe('none');
		expect(navigationKind(null, '/accounts')).toBe('none');
		expect(navigationKind('/accounts', undefined)).toBe('none');
	});

	it('slides forward into a detail and back out of it', () => {
		expect(navigationKind('/accounts', '/accounts/[id]')).toBe('forward');
		expect(navigationKind('/reports', '/reports/spending')).toBe('forward');
		expect(navigationKind('/accounts/[id]', '/accounts')).toBe('back');
	});

	it('fades between tabs, and between details of different tabs', () => {
		expect(navigationKind('/budget/[month]', '/accounts')).toBe('fade');
		expect(navigationKind('/accounts/[id]', '/reports/spending')).toBe('fade');
		expect(navigationKind('/reports/spending', '/reports/payees')).toBe('fade');
	});
});

describe('loadsSettled', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves at once when nothing is loading', async () => {
		await expect(loadsSettled(writable(0), 200)).resolves.toBe(true);
	});

	it('resolves when the loads end', async () => {
		const count = writable(2);
		const settled = loadsSettled(count, 200);
		count.set(1);
		count.set(0);
		await expect(settled).resolves.toBe(true);
	});

	it('gives up after the time allowed', async () => {
		vi.useFakeTimers();
		const settled = loadsSettled(writable(1), 200);
		vi.advanceTimersByTime(200);
		await expect(settled).resolves.toBe(false);
	});
});
