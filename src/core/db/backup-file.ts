import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate';
import { DomainError } from '$domain/errors';

/**
 * A `.moneta` backup is a ZIP file: `moneta.json` (the manifest) first, then one SQLite image per
 * budget under `budgets/`. `encryption` is always null for now. An encrypted backup will keep
 * `moneta.json` (with the key derivation and cipher parameters, but no budget names) next to a
 * `payload.bin` holding the encrypted inner ZIP, laid out as below: reading one decrypts between
 * `readZip` and `unpack`.
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

/**
 * Reads a `.moneta` backup, or a legacy `.sqlite` one. Only the container is checked here: each
 * budget's image still goes through `checkBackup`.
 */
export function readBackup(bytes: Uint8Array): BackupContents {
	if (startsWith(bytes, SQLITE_HEADER))
		return { createdAt: null, budgets: [{ id: null, name: null, image: bytes }] };
	if (!startsWith(bytes, ZIP_HEADER)) throw new DomainError('BACKUP_NOT_RECOGNIZED');
	const { manifest, files } = readZip(bytes);
	if (manifest.format !== BACKUP_FORMAT)
		throw new DomainError('BACKUP_NOT_RECOGNIZED', `Not a ${BACKUP_FORMAT}`);
	const { version } = manifest;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
		throw new DomainError('BACKUP_DAMAGED', `Bad version in ${MANIFEST}`);
	if (version > BACKUP_VERSION) throw new DomainError('BACKUP_TOO_NEW', `Version ${version}`);
	if (manifest.encryption != null) throw new DomainError('BACKUP_ENCRYPTED');
	return unpack(manifest, files);
}
