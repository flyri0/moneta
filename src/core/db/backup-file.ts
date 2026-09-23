import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate';
import { DomainError } from '$domain/errors';
import {
	decrypt,
	encrypt,
	newIv,
	openKey,
	readIv,
	toBase64,
	type BackupKeys,
	type BackupSecret
} from './backup-crypto';

/**
 * A `.moneta` backup is a ZIP file: `moneta.json` (the manifest) first, then one SQLite image per
 * budget under `budgets/`, with `encryption: null`. An encrypted backup is a ZIP too: its
 * `moneta.json` holds only the cipher, the IV and the key slots (no dates, no budget names), and
 * `payload.bin` holds a whole plain backup, encrypted with AES-256-GCM. The exact bytes of that
 * `moneta.json` are the associated data, so changing it breaks decryption. Apps without
 * encryption refuse it (BACKUP_ENCRYPTED), so it needs no new version.
 */
export const BACKUP_FORMAT = 'moneta-backup';
/**
 * The version of the container, not of the budgets in it. Bump it when an app that reads the
 * current version would misread the new files: a changed layout, a new required field, a field
 * whose meaning changes. Older apps then refuse them (BACKUP_TOO_NEW) instead of restoring them
 * wrong. Optional fields they can ignore don't need a bump, and neither do schema migrations:
 * each budget keeps its own `user_version` and `checkBackup` migrates it. Reading must keep
 * working for every earlier version.
 */
export const BACKUP_VERSION = 1;

const MANIFEST = 'moneta.json';
const PAYLOAD = 'payload.bin';
const CIPHER = 'AES-256-GCM';
/** Most a backup may unpack to, against ZIP bombs. */
const MAX_UNPACKED = 1 << 30;
const ID = /^[0-9a-f-]{1,64}$/;
const SQLITE_HEADER = 'SQLite format 3\0';
const ZIP_HEADER = 'PK\x03\x04';

/** A budget to write: its id is the uuid of its file name (`budget-<id>.sqlite3`). */
export interface BackupBudget {
	id: string;
	name: string;
	image: Uint8Array;
}

/** A budget read from a backup. A legacy `.sqlite` backup has neither an id nor a name. */
export interface BackupEntry {
	id: string | null;
	name: string | null;
	image: Uint8Array;
}

export interface BackupContents {
	/** When the backup was made, or null for a legacy `.sqlite` backup. */
	createdAt: string | null;
	budgets: BackupEntry[];
}

interface Manifest {
	format: string;
	version: number;
	createdAt: string;
	encryption: null;
	budgets: { id: string; name: string; path: string }[];
}

function pathOf(id: string): string {
	return `budgets/${id}.sqlite`;
}

function startsWith(bytes: Uint8Array, header: string): boolean {
	if (bytes.length < header.length) return false;
	for (let i = 0; i < header.length; i++) if (bytes[i] !== header.charCodeAt(i)) return false;
	return true;
}

/** The bytes of a `.moneta` file holding `budgets`. */
export function writeBackup(budgets: BackupBudget[], createdAt: string): Uint8Array<ArrayBuffer> {
	const manifest: Manifest = {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		createdAt,
		encryption: null,
		budgets: budgets.map(({ id, name }) => ({ id, name, path: pathOf(id) }))
	};
	const files: Zippable = { [MANIFEST]: strToU8(JSON.stringify(manifest, null, '\t')) };
	for (const { id, image } of budgets) files[pathOf(id)] = image;
	return zipSync(files);
}

function readZip(bytes: Uint8Array): { manifest: Record<string, unknown>; files: Unzipped } {
	let files: Unzipped;
	let unpacked = 0;
	try {
		files = unzipSync(bytes, {
			filter(file) {
				unpacked += file.originalSize;
				if (unpacked > MAX_UNPACKED) throw new DomainError('BACKUP_DAMAGED', 'Backup too large');
				return true;
			}
		});
	} catch (err) {
		if (err instanceof DomainError) throw err;
		throw new DomainError('BACKUP_DAMAGED', String(err));
	}
	if (!files[MANIFEST]) throw new DomainError('BACKUP_NOT_RECOGNIZED', `No ${MANIFEST}`);
	let manifest: unknown;
	try {
		manifest = JSON.parse(strFromU8(files[MANIFEST]));
	} catch {
		throw new DomainError('BACKUP_DAMAGED', `Bad ${MANIFEST}`);
	}
	if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
		throw new DomainError('BACKUP_DAMAGED', `Bad ${MANIFEST}`);
	return { manifest: manifest as Record<string, unknown>, files };
}

function unpack(manifest: Record<string, unknown>, files: Unzipped): BackupContents {
	const { budgets, createdAt } = manifest;
	if (!Array.isArray(budgets) || typeof createdAt !== 'string')
		throw new DomainError('BACKUP_DAMAGED', `Bad ${MANIFEST}`);
	const seen = new Set<string>();
	return {
		createdAt,
		budgets: budgets.map((entry: unknown) => {
			const { id, name, path } = (entry ?? {}) as Record<string, unknown>;
			if (typeof id !== 'string' || !ID.test(id) || seen.has(id) || typeof name !== 'string')
				throw new DomainError('BACKUP_DAMAGED', `Bad budget entry in ${MANIFEST}`);
			if (typeof path !== 'string' || !Object.hasOwn(files, path))
				throw new DomainError('BACKUP_DAMAGED', `Missing file for budget ${id}`);
			seen.add(id);
			return { id, name, image: files[path] };
		})
	};
}

/** The manifest and files of a `.moneta` ZIP, checked up to its version. */
function readContainer(bytes: Uint8Array): { manifest: Record<string, unknown>; files: Unzipped } {
	if (!startsWith(bytes, ZIP_HEADER)) throw new DomainError('BACKUP_NOT_RECOGNIZED');
	const { manifest, files } = readZip(bytes);
	if (manifest.format !== BACKUP_FORMAT)
		throw new DomainError('BACKUP_NOT_RECOGNIZED', `Not a ${BACKUP_FORMAT}`);
	const { version } = manifest;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
		throw new DomainError('BACKUP_DAMAGED', `Bad version in ${MANIFEST}`);
	if (version > BACKUP_VERSION) throw new DomainError('BACKUP_TOO_NEW', `Version ${version}`);
	return { manifest, files };
}

/**
 * Reads a `.moneta` backup, or a legacy `.sqlite` one. Only the container is checked here: each
 * budget's image still goes through `checkBackup`. An encrypted backup is BACKUP_ENCRYPTED:
 * `openSealed` turns it into a plain one first.
 */
export function readBackup(bytes: Uint8Array): BackupContents {
	if (startsWith(bytes, SQLITE_HEADER))
		return { createdAt: null, budgets: [{ id: null, name: null, image: bytes }] };
	const { manifest, files } = readContainer(bytes);
	if (manifest.encryption != null) throw new DomainError('BACKUP_ENCRYPTED');
	return unpack(manifest, files);
}

/** A plain backup (from `writeBackup`) encrypted with the backup key of a setup. */
export async function sealBackup(
	inner: Uint8Array<ArrayBuffer>,
	{ key, slots }: BackupKeys
): Promise<Uint8Array<ArrayBuffer>> {
	const iv = newIv();
	const manifest = strToU8(
		JSON.stringify(
			{
				format: BACKUP_FORMAT,
				version: BACKUP_VERSION,
				encryption: { cipher: CIPHER, iv: toBase64(iv), keys: slots }
			},
			null,
			'\t'
		)
	);
	const payload = await encrypt(key, iv, inner, manifest);
	// The payload is random bytes: compressing it would only waste time.
	return zipSync({ [MANIFEST]: manifest, [PAYLOAD]: [payload, { level: 0 }] });
}

/** Whether `bytes` are an encrypted `.moneta` backup. */
export function isSealed(bytes: Uint8Array): boolean {
	try {
		return readContainer(bytes).manifest.encryption != null;
	} catch {
		return false;
	}
}

/**
 * The plain backup inside an encrypted one, opened with its password or recovery key.
 * BACKUP_WRONG_KEY when `secret` doesn't open it (or the payload was changed).
 */
export async function openSealed(
	bytes: Uint8Array,
	secret: BackupSecret
): Promise<Uint8Array<ArrayBuffer>> {
	const { manifest, files } = readContainer(bytes);
	const { encryption } = manifest;
	if (encryption == null) throw new DomainError('INVALID_INPUT', 'Backup not encrypted');
	if (typeof encryption !== 'object' || Array.isArray(encryption))
		throw new DomainError('BACKUP_DAMAGED', `Bad encryption in ${MANIFEST}`);
	const { cipher, iv: ivText, keys } = encryption as Record<string, unknown>;
	if (cipher !== CIPHER) throw new DomainError('BACKUP_TOO_NEW', `Cipher ${cipher}`);
	const iv = readIv(ivText);
	const payload = files[PAYLOAD];
	if (!iv || !payload) throw new DomainError('BACKUP_DAMAGED', `Bad encryption in ${MANIFEST}`);
	const key = await openKey(keys, secret);
	return decrypt(
		key,
		iv,
		payload as Uint8Array<ArrayBuffer>,
		files[MANIFEST] as Uint8Array<ArrayBuffer>
	);
}
