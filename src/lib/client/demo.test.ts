import { afterEach, describe, expect, it } from 'vitest';
import { demoBudget } from '$lib/demo/content';
import { DEMO_FILE, endDemo, isDemoOpen, openDemo, requestDemo, sweepDemo } from './demo';
import { loadRegistry } from './registry';
import { createTestClient, memoryStore } from './testing';

const BUDGET = demoBudget('en-US', '2026-09-20');

let close: (() => void) | null = null;
afterEach(() => {
	close?.();
	close = null;
});

async function setup() {
	const test = await createTestClient();
	close = test.close;
	return { api: test.client.api, files: test.files, store: memoryStore() };
}

describe('openDemo', () => {
	it('builds the demo the first time and keeps it out of the registry', async () => {
		const { api, files, store } = await setup();
		const { file, meta } = await openDemo(api, store, BUDGET);

		expect(file).toBe(DEMO_FILE);
		expect(meta.name).toBe(BUDGET.init.name);
		expect([...files.keys()]).toContain(DEMO_FILE);
		expect((await api.accounts.list()).length).toBe(3);
		expect(loadRegistry(store)).toEqual({ budgets: [], lastOpened: null });
		expect(isDemoOpen(store)).toBe(true);
	});

	it('reuses the demo it already built', async () => {
		const { api, store } = await setup();
		await openDemo(api, store, BUDGET);
		const before = (await api.transactions.list()).length;

		await openDemo(api, store, BUDGET);
		expect((await api.transactions.list()).length).toBe(before);
	});

	it('fills in a file left behind uninitialized', async () => {
		const { api, store } = await setup();
		await api.system.open(DEMO_FILE);
		expect(await api.meta.isInitialized()).toBe(false);

		await openDemo(api, store, BUDGET);
		expect(await api.meta.isInitialized()).toBe(true);
	});

	it('throws away the file and the flag when building fails', async () => {
		const { api, files, store } = await setup();
		const broken = { ...BUDGET, init: { ...BUDGET.init, name: '  ' } };

		await expect(openDemo(api, store, broken)).rejects.toThrow();
		expect([...files.keys()]).not.toContain(DEMO_FILE);
		expect(isDemoOpen(store)).toBe(false);
	});
});

describe('the demo flag', () => {
	it('is off until it is asked for, and off again once it ends', () => {
		const store = memoryStore();
		expect(isDemoOpen(store)).toBe(false);
		requestDemo(store);
		expect(isDemoOpen(store)).toBe(true);
		endDemo(store);
		expect(isDemoOpen(store)).toBe(false);
	});
});

describe('sweepDemo', () => {
	it('deletes the demo file when there is one', async () => {
		const { api, files, store } = await setup();
		await openDemo(api, store, BUDGET);

		await sweepDemo(api, await api.system.listFiles());
		expect([...files.keys()]).not.toContain(DEMO_FILE);
	});

	it('does nothing when there is no demo', async () => {
		const { api, files } = await setup();
		await sweepDemo(api, await api.system.listFiles());
		expect(files.size).toBe(0);
	});
});
