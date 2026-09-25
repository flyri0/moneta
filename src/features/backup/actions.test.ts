import { describe, it, expect, afterEach } from 'vitest';
import { createBudget, type NewBudget } from '$client/session';
import { createTestClient, memoryStore } from '$client/testing';
import type { BudgetDump } from '$db/repos/dump';
import { todayIso } from '$domain/month';
import { newRecoveryKey } from '$domain/recovery-key';
import {
	backUp,
	downloadCopy,
	exportBudgetJson,
	exportTransactionsCsv,
	markBackedUp,
	readBackupFile
} from './actions';
import type { BackupTarget, SaveResult } from './target';

const HOME: NewBudget = {
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
};

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

async function setup() {
	const test = await createTestClient();
	clients.push(test);
	const api = test.client.api;
	const { meta } = await createBudget(api, memoryStore(), HOME);
	const saved: { fileName: string; data: Blob }[] = [];
	const target: BackupTarget & { result: SaveResult } = {
		result: 'saved',
		async save(fileName, data) {
			saved.push({ fileName, data: await data });
			return this.result;
		}
	};
	return { test, api, session: { api, meta }, saved, target };
}

describe('backUp', () => {
	it('saves every budget as one .moneta file and records the backup date in each', async () => {
		const { test, api, saved, target } = await setup();
		const [home] = await api.system.listFiles();
		await createBudget(api, memoryStore(), { ...HOME, name: 'Trip' });
		// The demo is not a budget of its own and stays out.
		await api.system.open('demo.sqlite3');
		await api.system.open(home);
		const now = new Date(2026, 8, 19, 10, 0);
		expect((await backUp(api, target, now)).skipped).toEqual([]);
		expect(saved[0].fileName).toBe('moneta-backup-2026-09-19-100000.moneta');
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		const { budgets } = await api.system.inspectBackup(bytes);
		expect(budgets.map((b) => b.name).sort()).toEqual(['Home', 'Trip']);
		expect((await api.meta.get()).lastBackupAt).toBe(now.toISOString());
		expect(test.files.has('demo.sqlite3')).toBe(true);
	});

	it('returns the files it had to leave out, and does not mark them', async () => {
		const { api, saved, target } = await setup();
		const [home] = await api.system.listFiles();
		const broken = 'budget-0190a000-0000-7000-8000-00000000000f.sqlite3';
		// Created but never initialized, as an interrupted onboarding leaves it.
		await api.system.open(broken);
		await api.system.open(home);
		expect((await backUp(api, target)).skipped).toEqual([broken]);
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		expect((await api.system.inspectBackup(bytes)).budgets.map((b) => b.name)).toEqual(['Home']);
	});
});

describe('backUp, depending on whether the file was saved', () => {
	it('records nothing when saving was cancelled', async () => {
		const { api, target } = await setup();
		target.result = 'cancelled';
		expect((await backUp(api, target)).result).toBe('cancelled');
		expect((await api.meta.get()).lastBackupAt).toBeNull();
	});

	it('leaves recording to the caller when the browser does not say', async () => {
		const { api, target } = await setup();
		target.result = 'unknown';
		const now = new Date(2026, 8, 19, 10, 0);
		const done = await backUp(api, target, now);
		expect(done.result).toBe('unknown');
		expect((await api.meta.get()).lastBackupAt).toBeNull();
		await markBackedUp(api, done);
		expect((await api.meta.get()).lastBackupAt).toBe(now.toISOString());
	});
});

describe('readBackupFile', () => {
	it('reads a picked file, and says whether it needs a password first', async () => {
		const { api, saved, target } = await setup();
		await backUp(api, target);
		await api.system.setBackupEncryption('correct horse', newRecoveryKey());
		await backUp(api, target);
		const [plain, encrypted] = await Promise.all(saved.map((s) => readBackupFile(api, s.data)));
		expect(plain.encrypted).toBe(false);
		expect((await api.system.inspectBackup(plain.bytes)).budgets).toHaveLength(1);
		expect(encrypted.encrypted).toBe(true);
		const unlocked = await api.system.unlockBackup(encrypted.bytes, { password: 'correct horse' });
		expect((await api.system.inspectBackup(unlocked)).budgets.map((b) => b.name)).toEqual(['Home']);
	});
});

describe('downloadCopy', () => {
	it('saves a saved copy as a .moneta backup named for the day it was saved', async () => {
		const { test, api, saved, target } = await setup();
		const [file] = await api.system.listFiles();
		const copy = `premigration-${file.replace('.sqlite3', '')}-20260801120000000.sqlite3`;
		test.files.set(copy, test.files.get(file)!);
		const [listed] = await api.system.listCopies(file);
		await downloadCopy(api, listed, 'Home', target);
		// Named for when the copy was saved (12:00 UTC), in local time.
		const savedAt = new Date('2026-08-01T12:00:00.000Z');
		const time = [savedAt.getHours(), savedAt.getMinutes(), 0]
			.map((n) => String(n).padStart(2, '0'))
			.join('');
		expect(saved[0].fileName).toBe(`moneta-home-${todayIso(savedAt)}-${time}.moneta`);
		const bytes = new Uint8Array(await saved[0].data.arrayBuffer());
		expect((await api.system.inspectBackup(bytes)).budgets).toEqual([
			{ index: 0, id: file.replace(/^budget-|\.sqlite3$/g, ''), name: 'Home' }
		]);
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
