import { describe, it, expect, afterEach } from 'vitest';
import { createBudget } from '$client/session';
import { createTestClient, memoryStore } from '$client/testing';
import type { BudgetDump } from '$db/repos/dump';
import { backUp, downloadCopy, exportBudgetJson, exportTransactionsCsv } from './actions';
import type { BackupTarget } from './target';

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

async function setup() {
	const test = await createTestClient();
	clients.push(test);
	const api = test.client.api;
	const { meta } = await createBudget(api, memoryStore(), {
		name: 'Home',
		currency: 'USD',
		locale: 'en-US',
		groups: [{ name: 'Everyday', categories: ['Food'] }],
		account: {
			name: 'Checking',
			type: 'checking',
			onBudget: true,
			startingBalance: 150000,
			startingDate: '2026-09-01'
		}
	});
	const saved: { fileName: string; data: Blob }[] = [];
	const target: BackupTarget = {
		save: async (fileName, data) => void saved.push({ fileName, data })
	};
	return { test, api, session: { api, meta }, saved, target };
}

describe('backUp', () => {
	it('saves the budget as a .sqlite file and records the backup date', async () => {
		const { api, session, saved, target } = await setup();
		await backUp(session, target, new Date(2026, 8, 19, 10, 0));
		expect(saved[0].fileName).toBe('moneta-home-2026-09-19.sqlite');
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe('SQLite format 3');
		expect((await api.meta.get()).lastBackupAt).toBe(new Date(2026, 8, 19, 10, 0).toISOString());
	});
});

describe('downloadCopy', () => {
	it('saves a pre-migration copy as a .sqlite backup named for the day it was saved', async () => {
		const { test, api, saved, target } = await setup();
		const [file] = await api.system.listFiles();
		const copy = `premigration-${file.replace('.sqlite3', '')}-20260801120000000.sqlite3`;
		test.files.set(copy, test.files.get(file)!);
		const [listed] = await api.system.listCopies(file);
		await downloadCopy(api, listed, 'Home', target);
		expect(saved[0].fileName).toBe('moneta-home-2026-08-01.sqlite');
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe('SQLite format 3');
	});
});

describe('exportTransactionsCsv / exportBudgetJson', () => {
	it('saves the transactions as CSV and the budget as JSON', async () => {
		const { session, saved, target } = await setup();
		const now = new Date(2026, 8, 19, 10, 0);
		await exportTransactionsCsv(session, target, now);
		await exportBudgetJson(session, target, now);
		expect(saved.map((s) => s.fileName)).toEqual([
			'moneta-home-2026-09-19.csv',
			'moneta-home-2026-09-19.json'
		]);
		expect(await saved[0].data.text()).toContain('2026-09-01,Checking,Starting Balance,');
		const dump = JSON.parse(await saved[1].data.text()) as BudgetDump;
		expect(dump.meta.name).toBe('Home');
	});
});
