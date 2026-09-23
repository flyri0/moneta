import { MIN_PASSWORD_LENGTH, normalizePassword } from '$domain/backup-password';
import { DomainError } from '$domain/errors';
import { parseRecoveryKey } from '$domain/recovery-key';

/**
 * Encryption for `.moneta` backups, with Web Crypto only. Each setup makes a random AES-256-GCM
 * backup key and wraps it (AES-KW) twice: with a key derived from the password (PBKDF2-SHA256)
 * and with one derived from the recovery key (HKDF-SHA256; it is random, so it needs no slow
 * derivation). Either slot opens every backup made under that setup.
 */

/** PBKDF2 iterations for a new setup (OWASP's figure for PBKDF2-HMAC-SHA256). */
export const PASSWORD_ITERATIONS = 600_000;
/** Most iterations a file may ask for, so a hostile one can't hang the worker. */
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
/** A wrapped 256-bit key: the key plus AES-KW's 8-byte check. */
const WRAPPED_BYTES = 40;
const RECOVERY_INFO = new TextEncoder().encode('moneta backup recovery');

export interface PasswordSlot {
	type: 'password';
	kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
	wrapped: string;
}

export interface RecoverySlot {
	type: 'recovery';
	kdf: { name: 'HKDF-SHA256'; salt: string };
	wrapped: string;
}

/** A copy of the backup key, wrapped with a key derived from one secret. Binary fields are base64. */
export type KeySlot = PasswordSlot | RecoverySlot;

/** What the user types to open an encrypted backup. */
export type BackupSecret = { password: string } | { recoveryKey: string };

/** The backup key of a setup (non-extractable) and its slots, as the device keeps them. */
export interface BackupKeys {
	key: CryptoKey;
	slots: KeySlot[];
}

type Bytes = Uint8Array<ArrayBuffer>;

function random(length: number): Bytes {
	return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: Uint8Array): string {
	let text = '';
	for (const byte of bytes) text += String.fromCharCode(byte);
	return btoa(text);
}

/** The bytes of `text`, or null unless it is base64 for exactly `length` bytes. */
export function fromBase64(text: unknown, length: number): Bytes | null {
	if (typeof text !== 'string') return null;
	let raw: string;
	try {
		raw = atob(text);
	} catch {
		return null;
	}
	if (raw.length !== length) return null;
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const WRAPPING = { name: 'AES-KW', length: 256 } as const;

async function passwordKek(password: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
	const text = new TextEncoder().encode(normalizePassword(password));
	const base = await crypto.subtle.importKey('raw', text, 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		base,
		WRAPPING,
		false,
		['wrapKey', 'unwrapKey']
	);
}

async function recoveryKek(recoveryKey: Bytes, salt: Bytes): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey('raw', recoveryKey, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt, info: RECOVERY_INFO },
		base,
		WRAPPING,
		false,
		['wrapKey', 'unwrapKey']
	);
}

async function unwrap(wrapped: Bytes, kek: CryptoKey): Promise<CryptoKey> {
	try {
		return await crypto.subtle.unwrapKey('raw', wrapped, kek, 'AES-KW', 'AES-GCM', false, [
			'encrypt',
			'decrypt'
		]);
	} catch {
		throw new DomainError('BACKUP_WRONG_KEY');
	}
}

/**
 * A new setup: a random backup key, wrapped with `password` and with `recoveryKey`. INVALID_INPUT
 * for a password shorter than 8 characters or a recovery key that doesn't parse.
 */
export async function createKeys(
	password: string,
	recoveryKey: string,
	iterations: number = PASSWORD_ITERATIONS
): Promise<BackupKeys> {
	if (typeof password !== 'string' || normalizePassword(password).length < MIN_PASSWORD_LENGTH)
		throw new DomainError('INVALID_INPUT', 'Password too short');
	const recovery = typeof recoveryKey === 'string' ? parseRecoveryKey(recoveryKey) : null;
	if (!recovery) throw new DomainError('INVALID_INPUT', 'Bad recovery key');
	const backupKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
	const passwordSalt = random(SALT_BYTES);
	const recoverySalt = random(SALT_BYTES);
	const byPassword = await passwordKek(password, passwordSalt, iterations);
	const byRecovery = await recoveryKek(recovery as Bytes, recoverySalt);
	const wrapped = new Uint8Array(
		await crypto.subtle.wrapKey('raw', backupKey, byPassword, 'AES-KW')
	);
	const slots: KeySlot[] = [
		{
			type: 'password',
			kdf: { name: 'PBKDF2-SHA256', iterations, salt: toBase64(passwordSalt) },
			wrapped: toBase64(wrapped)
		},
		{
			type: 'recovery',
			kdf: { name: 'HKDF-SHA256', salt: toBase64(recoverySalt) },
			wrapped: toBase64(
				new Uint8Array(await crypto.subtle.wrapKey('raw', backupKey, byRecovery, 'AES-KW'))
			)
		}
	];
	// Keep a non-extractable copy: the raw key never has to leave Web Crypto again.
	return { key: await unwrap(wrapped, byPassword), slots };
}

/**
 * The backup key from the slot `secret` opens. `slots` come from a file: a slot of an unknown
 * type is skipped, a missing slot or an unknown derivation is BACKUP_TOO_NEW, a malformed one is
 * BACKUP_DAMAGED, and a secret that doesn't open it is BACKUP_WRONG_KEY.
 */
export async function openKey(slots: unknown, secret: BackupSecret): Promise<CryptoKey> {
	if (!Array.isArray(slots)) throw new DomainError('BACKUP_DAMAGED', 'Bad key slots');
	const type = 'password' in secret ? 'password' : 'recovery';
	const slot: unknown = slots.find((s) => isObject(s) && s.type === type);
	if (!isObject(slot)) throw new DomainError('BACKUP_TOO_NEW', `No ${type} slot`);
	const { kdf } = slot;
	if (!isObject(kdf)) throw new DomainError('BACKUP_DAMAGED', 'Bad key slot');
	const expected = type === 'password' ? 'PBKDF2-SHA256' : 'HKDF-SHA256';
	if (kdf.name !== expected) throw new DomainError('BACKUP_TOO_NEW', `Key derivation ${kdf.name}`);
	const salt = fromBase64(kdf.salt, SALT_BYTES);
	const wrapped = fromBase64(slot.wrapped, WRAPPED_BYTES);
	if (!salt || !wrapped) throw new DomainError('BACKUP_DAMAGED', 'Bad key slot');

	if ('password' in secret) {
		const { iterations } = kdf;
		if (
			typeof iterations !== 'number' ||
			!Number.isInteger(iterations) ||
			iterations < 1 ||
			iterations > MAX_ITERATIONS
		)
			throw new DomainError('BACKUP_DAMAGED', 'Bad iterations');
		if (typeof secret.password !== 'string') throw new DomainError('BACKUP_WRONG_KEY');
		return unwrap(wrapped, await passwordKek(secret.password, salt, iterations));
	}
	const recovery =
		typeof secret.recoveryKey === 'string' ? parseRecoveryKey(secret.recoveryKey) : null;
	if (!recovery) throw new DomainError('BACKUP_WRONG_KEY');
	return unwrap(wrapped, await recoveryKek(recovery as Bytes, salt));
}

/** A fresh IV for one encryption with a backup key. */
export function newIv(): Bytes {
	return random(IV_BYTES);
}

/** Reads an IV from a file, or null when it is malformed. */
export function readIv(text: unknown): Bytes | null {
	return fromBase64(text, IV_BYTES);
}

/** AES-GCM of `data`, bound to `aad` (the bytes of the manifest). */
export async function encrypt(
	key: CryptoKey,
	iv: Bytes,
	data: Uint8Array<ArrayBuffer>,
	aad: Bytes
): Promise<Bytes> {
	return new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, data)
	);
}

/** Undoes `encrypt`. BACKUP_WRONG_KEY when the key, the data or `aad` don't match. */
export async function decrypt(
	key: CryptoKey,
	iv: Bytes,
	data: Uint8Array<ArrayBuffer>,
	aad: Bytes
): Promise<Bytes> {
	try {
		return new Uint8Array(
			await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, data)
		);
	} catch {
		throw new DomainError('BACKUP_WRONG_KEY');
	}
}
