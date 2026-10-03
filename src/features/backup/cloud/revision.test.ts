import { describe, it, expect } from 'vitest';
import type { RemoteBackup } from './provider';
import {
	adopted,
	compareRemote,
	keptOver,
	nextRevision,
	parseRevision,
	revisionProperties,
	type RemoteRevision,
	type Revision
} from './revision';

const R = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

let ids = 100;
const newId = () => R(ids++);

function backup(
	device: string,
	revision: RemoteRevision | null,
	modifiedAt = '2026-10-01T12:00:00.000Z'
): RemoteBackup {
	return {
		id: `${device}-${modifiedAt}`,
		name: 'moneta-backup.moneta',
		day: modifiedAt.slice(0, 10),
		device,
		deviceLabel: device,
		modifiedAt,
		size: 1,
		revision
	};
}

/** What a device uploads: its revision as the other devices read it. */
function uploaded(device: string, local: Revision, modifiedAt?: string): RemoteBackup {
	return backup(device, { rev: local.rev, gen: local.gen, base: local.base }, modifiedAt);
}

describe('parseRevision', () => {
	it('reads what revisionProperties writes', () => {
		const revision = { rev: R(1), gen: 3, base: R(2) };
		expect(parseRevision(revisionProperties(revision))).toEqual(revision);
		expect(parseRevision(revisionProperties({ rev: R(1), gen: 1, base: null }))).toEqual({
			rev: R(1),
			gen: 1,
			base: null
		});
	});

	it('ignores backups without a revision or with a broken one', () => {
		expect(parseRevision({})).toBeNull();
		expect(parseRevision({ rev: R(1) })).toBeNull();
		expect(parseRevision({ rev: 'x', gen: '1' })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: '-1' })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: '1.5' })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: '1e3' })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: '99999999999999999999' })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: String(2 ** 48 + 1) })).toBeNull();
		expect(parseRevision({ rev: R(1), gen: String(2 ** 48) })).not.toBeNull();
		expect(parseRevision({ rev: R(1), gen: '2', base: 'nope' })).toEqual({
			rev: R(1),
			gen: 2,
			base: null
		});
	});
});

describe('nextRevision', () => {
	it('starts at 1, moves on with changes, and stays put without them', () => {
		const first = nextRevision(null, false, newId);
		expect(first).toMatchObject({ gen: 1, own: true, base: null });
		expect(nextRevision(first, false, newId)).toBe(first);
		const second = nextRevision(first, true, newId);
		expect(second.gen).toBe(2);
		expect(second.rev).not.toBe(first.rev);
		expect(second.own).toBe(true);
	});

	it('keeps the base it adopted', () => {
		const local = adopted({ rev: R(1), gen: 4, base: null });
		expect(local).toEqual({ rev: R(1), gen: 4, own: false, base: R(1) });
		expect(nextRevision(local, true, newId)).toMatchObject({ gen: 5, own: true, base: R(1) });
	});
});

describe('compareRemote', () => {
	it('is current with no other device, or only old backups without a revision', () => {
		const local = nextRevision(null, false, newId);
		expect(compareRemote(local, false, [uploaded('me', local)], 'me')).toEqual({ kind: 'current' });
		expect(compareRemote(local, true, [backup('pc', null)], 'me')).toEqual({ kind: 'current' });
	});

	it('offers the computer version to a phone that changed nothing since adopting it', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone = adopted(pc1);
		const pc2 = nextRevision(pc1, true, newId);
		const result = compareRemote(phone, false, [uploaded('pc', pc2)], 'phone');
		expect(result).toMatchObject({ kind: 'newer', backup: { device: 'pc' } });
	});

	it('does not call a phone re-uploading stale data newer', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone = adopted(pc1);
		const pc2 = nextRevision(pc1, true, newId);
		// The phone's daily upload without changes keeps the revision it adopted.
		const phoneUpload = nextRevision(phone, false, newId);
		expect(phoneUpload).toBe(phone);
		expect(
			compareRemote(pc2, false, [uploaded('phone', phoneUpload, '2026-10-02T09:00:00.000Z')], 'pc')
		).toEqual({ kind: 'current' });
	});

	it('warns both sides when both changed', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone1 = adopted(pc1);
		const pc2 = nextRevision(pc1, true, newId);
		const phone2 = nextRevision(phone1, true, newId);
		expect(compareRemote(phone2, false, [uploaded('pc', pc2)], 'phone')).toMatchObject({
			kind: 'diverged'
		});
		expect(compareRemote(pc2, false, [uploaded('phone', phone2)], 'pc')).toMatchObject({
			kind: 'diverged'
		});
	});

	it('warns when changes are waiting here, even with nothing uploaded of them', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone = adopted(pc1);
		const pc2 = nextRevision(pc1, true, newId);
		expect(compareRemote(phone, true, [uploaded('pc', pc2)], 'phone')).toMatchObject({
			kind: 'diverged'
		});
	});

	it('offers a version that went on from this one', () => {
		const phone1 = nextRevision(null, true, newId);
		const pc1 = nextRevision(adopted(phone1), true, newId);
		const pc2 = nextRevision(pc1, true, newId);
		expect(compareRemote(phone1, false, [uploaded('pc', pc2)], 'phone')).toMatchObject({
			kind: 'newer'
		});
		// But not when the phone moved on as well.
		const phone2 = nextRevision(phone1, true, newId);
		expect(compareRemote(phone2, false, [uploaded('pc', pc2)], 'phone')).toMatchObject({
			kind: 'diverged'
		});
	});

	it('after keeping this version, the other device is warned, not offered it', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone1 = nextRevision(adopted(pc1), true, newId);
		const pc2 = nextRevision(pc1, true, newId);
		const pc3 = nextRevision(pc2, true, newId);
		const remote = uploaded('pc', pc3);
		const kept = keptOver(phone1, remote.revision!, newId);
		expect(kept.gen).toBeGreaterThan(pc3.gen);
		expect(compareRemote(kept, false, [remote], 'phone')).toEqual({ kind: 'current' });
		expect(compareRemote(pc3, false, [uploaded('phone', kept)], 'pc')).toMatchObject({
			kind: 'diverged'
		});
	});

	it('treats a device without a revision as having its own data', () => {
		const pc1 = nextRevision(null, true, newId);
		expect(compareRemote(null, false, [uploaded('pc', pc1)], 'phone')).toMatchObject({
			kind: 'diverged'
		});
	});

	it('picks the newest revision among other devices', () => {
		const pc1 = nextRevision(null, true, newId);
		const phone = adopted(pc1);
		const pc2 = nextRevision(pc1, true, newId);
		const tablet = nextRevision(adopted(pc2), true, newId);
		const result = compareRemote(
			phone,
			false,
			[uploaded('pc', pc1), uploaded('pc', pc2), uploaded('tablet', tablet)],
			'phone'
		);
		expect(result).toMatchObject({ kind: 'newer', backup: { device: 'tablet' } });
	});

	it('is conservative across three devices', () => {
		// The pc adopted the tablet's revision, which came from the phone's: the base doesn't match.
		const phone = nextRevision(null, true, newId);
		const tablet = nextRevision(adopted(phone), true, newId);
		const pc = nextRevision(adopted(tablet), true, newId);
		expect(compareRemote(phone, false, [uploaded('pc', pc)], 'phone')).toMatchObject({
			kind: 'diverged'
		});
	});
});
