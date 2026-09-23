import { describe, it, expect } from 'vitest';
import { DomainError, type ErrorCode } from '$domain/errors';
import { newRecoveryKey } from '$domain/recovery-key';
import { createKeys, decrypt, encrypt, newIv, openKey } from './backup-crypto';

const ITERATIONS = 1000;
const PASSWORD = 'correct horse';
const RECOVERY = newRecoveryKey();
const DATA = new TextEncoder().encode('the budget');
const AAD = new TextEncoder().encode('{"manifest":true}');

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode | undefined> {
	try {
		await promise;
	} catch (err) {
		if (err instanceof DomainError) return err.code;
		throw err;
	}
	return undefined;
}

/** Whether `key` decrypts what the backup key encrypted. */
async function opens(backupKey: CryptoKey, key: CryptoKey): Promise<boolean> {
	const iv = newIv();
	const sealed = await encrypt(backupKey, iv, DATA, AAD);
	return (await decrypt(key, iv, sealed, AAD)).every((b, i) => b === DATA[i]);
}

describe('createKeys and openKey', () => {
	it('opens the backup key with the password or the recovery key', async () => {
		const { key, slots } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		expect(slots.map((s) => s.type)).toEqual(['password', 'recovery']);
		expect(await opens(key, await openKey(slots, { password: PASSWORD }))).toBe(true);
		expect(await opens(key, await openKey(slots, { recoveryKey: RECOVERY }))).toBe(true);
	});

	it('accepts a recovery key typed loosely', async () => {
		const { key, slots } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		const typed = RECOVERY.toLowerCase().replaceAll('-', ' ');
		expect(await opens(key, await openKey(slots, { recoveryKey: typed }))).toBe(true);
	});

	it('matches a password however its accents were composed', async () => {
		const { key, slots } = await createKeys('São Paulo'.normalize('NFC'), RECOVERY, ITERATIONS);
		const nfd = 'São Paulo'.normalize('NFD');
		expect(await opens(key, await openKey(slots, { password: nfd }))).toBe(true);
	});

	it('rejects a wrong password or recovery key with BACKUP_WRONG_KEY', async () => {
		const { slots } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		expect(await codeOf(openKey(slots, { password: 'wrong horse' }))).toBe('BACKUP_WRONG_KEY');
		expect(await codeOf(openKey(slots, { recoveryKey: newRecoveryKey() }))).toBe(
			'BACKUP_WRONG_KEY'
		);
		expect(await codeOf(openKey(slots, { recoveryKey: 'not a key' }))).toBe('BACKUP_WRONG_KEY');
	});

	it('refuses a short password or a malformed recovery key', async () => {
		expect(await codeOf(createKeys('short', RECOVERY, ITERATIONS))).toBe('INVALID_INPUT');
		expect(await codeOf(createKeys(PASSWORD, 'nope', ITERATIONS))).toBe('INVALID_INPUT');
	});

	it('makes a new backup key and salts every time', async () => {
		const a = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		const b = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		expect(a.slots[0].kdf.salt).not.toBe(b.slots[0].kdf.salt);
		expect(await opens(a.key, b.key).catch(() => false)).toBe(false);
	});

	it('keeps the backup key on the device non-extractable', async () => {
		const { key } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		expect(key.extractable).toBe(false);
	});
});

describe('openKey on slots from a file', () => {
	async function slotsWith(change: (slots: Record<string, unknown>[]) => void) {
		const { slots } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		const copy = structuredClone(slots) as unknown as Record<string, unknown>[];
		change(copy);
		return copy;
	}

	it('skips slots of unknown types and reports a missing one as BACKUP_TOO_NEW', async () => {
		const slots = await slotsWith((s) => {
			s[0].type = 'passkey';
		});
		expect(await codeOf(openKey(slots, { password: PASSWORD }))).toBe('BACKUP_TOO_NEW');
		expect(await codeOf(openKey(slots, { recoveryKey: RECOVERY }))).toBeUndefined();
	});

	it('reports an unknown key derivation as BACKUP_TOO_NEW', async () => {
		const slots = await slotsWith((s) => {
			(s[0].kdf as Record<string, unknown>).name = 'Argon2id';
		});
		expect(await codeOf(openKey(slots, { password: PASSWORD }))).toBe('BACKUP_TOO_NEW');
	});

	it('reports bad iterations, salts or wrapped keys as BACKUP_DAMAGED', async () => {
		const cases: ((s: Record<string, unknown>[]) => void)[] = [
			(s) => ((s[0].kdf as Record<string, unknown>).iterations = 0),
			(s) => ((s[0].kdf as Record<string, unknown>).iterations = 50_000_000),
			(s) => ((s[0].kdf as Record<string, unknown>).iterations = 1.5),
			(s) => ((s[0].kdf as Record<string, unknown>).salt = 'AAAA'),
			(s) => ((s[0].kdf as Record<string, unknown>).salt = '%%%'),
			(s) => (s[0].wrapped = 'AAAA'),
			(s) => (s[0].kdf = null)
		];
		for (const change of cases)
			expect(await codeOf(openKey(await slotsWith(change), { password: PASSWORD }))).toBe(
				'BACKUP_DAMAGED'
			);
		expect(await codeOf(openKey('nope' as unknown as [], { password: PASSWORD }))).toBe(
			'BACKUP_DAMAGED'
		);
	});
});

describe('encrypt and decrypt', () => {
	it('fails with BACKUP_WRONG_KEY when the data or the associated data changed', async () => {
		const { key } = await createKeys(PASSWORD, RECOVERY, ITERATIONS);
		const iv = newIv();
		const sealed = await encrypt(key, iv, DATA, AAD);
		const flipped = sealed.slice();
		flipped[0] ^= 1;
		expect(await codeOf(decrypt(key, iv, flipped, AAD))).toBe('BACKUP_WRONG_KEY');
		expect(await codeOf(decrypt(key, iv, sealed, new Uint8Array([1])))).toBe('BACKUP_WRONG_KEY');
	});
});
