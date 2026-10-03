import { uuidv7 } from 'uuidv7';
import type { RemoteBackup } from './provider';

/**
 * Which version of the data a cloud backup holds, so a device can tell when another one has a
 * version it doesn't. Nothing is merged: the user restores one version or keeps this one.
 *
 * A device uploads a new `rev`, one `gen` up, only when it changed something since its last
 * upload; without changes it uploads the same revision again, so a device re-uploading old data
 * never looks newer. `base` is the revision it last adopted from another device by restoring it.
 */
export interface RemoteRevision {
	rev: string;
	gen: number;
	base: string | null;
}

/** This device's revision. `own`: made here, rather than adopted by restoring another's. */
export interface Revision extends RemoteRevision {
	own: boolean;
}

/** How this device stands against the backups of the others. */
export type RemoteState =
	| { kind: 'current' }
	/** Another device has a version, and this one has nothing restoring it would lose. */
	| { kind: 'newer'; backup: RemoteBackup }
	/** Another device has a version, and this one has changes of its own. */
	| { kind: 'diverged'; backup: RemoteBackup };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GEN = /^(0|[1-9][0-9]{0,15})$/;
/** The highest generation read: one upload a second would take millions of years to reach it. */
const MAX_GEN = 2 ** 48;

/**
 * A revision as a backup's properties carry it. A missing base is null, which removes the one an
 * earlier upload left on the same file (properties are merged on update).
 */
export function revisionProperties(revision: RemoteRevision): Record<string, string | null> {
	return { rev: revision.rev, gen: String(revision.gen), base: revision.base };
}

/**
 * The revision in a backup's properties, or null for a backup made before revisions or one whose
 * properties don't hold up: they come from the cloud, so they are checked like any input.
 */
export function parseRevision(props: Record<string, unknown>): RemoteRevision | null {
	const { rev, gen, base } = props;
	if (typeof rev !== 'string' || !UUID.test(rev)) return null;
	if (typeof gen !== 'string' || !GEN.test(gen)) return null;
	const n = Number(gen);
	// Far below the safe limit, so counting up from any accepted one stays exact.
	if (n > MAX_GEN) return null;
	return { rev, gen: n, base: typeof base === 'string' && UUID.test(base) ? base : null };
}

/** This device's revision as stored, or null when it isn't one. */
export function parseLocalRevision(value: unknown): Revision | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	const parsed = parseRevision({ ...raw, gen: String(raw.gen) });
	if (!parsed || typeof raw.own !== 'boolean') return null;
	return { ...parsed, own: raw.own };
}

/** The revision to upload: a new one after changes (`dirty`), else the same. */
export function nextRevision(
	local: Revision | null,
	dirty: boolean,
	newId: () => string = uuidv7
): Revision {
	if (local && !dirty) return local;
	return { rev: newId(), gen: (local?.gen ?? 0) + 1, own: true, base: local?.base ?? null };
}

/** This device's revision after restoring a backup with `remote`, all of it. */
export function adopted(remote: RemoteRevision): Revision {
	return { rev: remote.rev, gen: remote.gen, own: false, base: remote.rev };
}

/**
 * This device's revision once the user keeps its version over `remote`: newer than it, so this
 * device stops warning, but with its base unchanged, so the other device is warned that the
 * versions differ instead of being offered this one as newer.
 */
export function keptOver(
	local: Revision | null,
	remote: RemoteRevision,
	newId: () => string = uuidv7
): Revision {
	return {
		rev: newId(),
		gen: Math.max(remote.gen, local?.gen ?? 0) + 1,
		own: true,
		base: local?.base ?? null
	};
}

/**
 * Whether another device has a version this one lacks. `dirty`: changes here wait for a backup.
 * A device without a revision counts as having data of its own. Across three or more devices a
 * base may not match and warn of differences that aren't there; it never offers as newer a
 * version that would lose changes made here. A version with a lower `gen` is passed over even
 * when it diverged: its device is the one warned, as it sees this one's higher `gen`.
 */
export function compareRemote(
	local: Revision | null,
	dirty: boolean,
	backups: readonly RemoteBackup[],
	device: string
): RemoteState {
	let newest: (RemoteBackup & { revision: RemoteRevision }) | null = null;
	for (const backup of backups) {
		const remote = backup.revision;
		if (backup.device === device || !remote) continue;
		if (local && (remote.rev === local.rev || remote.gen < local.gen)) continue;
		if (
			!newest ||
			remote.gen > newest.revision.gen ||
			(remote.gen === newest.revision.gen && backup.modifiedAt > newest.modifiedAt)
		)
			newest = { ...backup, revision: remote };
	}
	if (!newest) return { kind: 'current' };
	const own = !local || dirty || (local.own && newest.revision.base !== local.rev);
	return { kind: own ? 'diverged' : 'newer', backup: newest };
}
