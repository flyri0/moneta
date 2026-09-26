/**
 * When cloud backups run by themselves, in the tab that holds the database. They run a while
 * after changes stop, when the page is hidden with a change waiting, and at start when the last
 * one is a day old. Nothing runs with the app closed: the budgets only exist in this browser.
 */

/** How long changes must stop before a backup, so a burst of edits makes one upload. */
export const QUIET_MS = 2 * 60_000;
/** A backup older than this is renewed at start, even without changes. */
export const STALE_MS = 24 * 60 * 60_000;
/** The wait at start, so the backup doesn't compete with the first screen. */
export const START_DELAY_MS = 10_000;
/** The waits before retrying an outage; the last one repeats. */
export const RETRY_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

/** Errors only the user can fix: automatic backups wait for `resume()`. */
const NEEDS_USER = new Set([
	'CLOUD_AUTH_NEEDED',
	'CLOUD_PERMISSION_DENIED',
	'CLOUD_NOT_ENCRYPTED',
	'BACKUP_KEYS_UNAVAILABLE'
]);

/** How far backups got, kept across sessions (`CloudSettings`). */
export interface BackupProgress {
	lastUploadAt: string | null;
	pendingSince: string | null;
}

export type AutoBackupStatus =
	| { kind: 'idle' }
	| { kind: 'running' }
	/** `retrying`: it tries again by itself; otherwise it waits for a change, or for the user. */
	| { kind: 'failed'; error: unknown; retrying: boolean };

export interface AutoBackup {
	start(): void;
	/** Data changed (the tables a write touched). */
	changed(tables: readonly string[]): void;
	/** The page is being hidden: back up a waiting change now. */
	flush(): void;
	/** The browser is back online. */
	online(): void;
	/** The user fixed what paused backups (signed in again, turned encryption on). */
	resume(): void;
	/** Backs up now, for a button; the caller gets its error. */
	runNow(): Promise<void>;
	stop(): void;
}

function codeOf(err: unknown): string | undefined {
	const code = (err as { code?: unknown } | null)?.code;
	return typeof code === 'string' ? code : undefined;
}

export function autoBackup(deps: {
	/** One backup; throws a DomainError when it fails. */
	run(): Promise<void>;
	progress: { load(): BackupProgress; save(progress: BackupProgress): void };
	onStatus?(status: AutoBackupStatus): void;
}): AutoBackup {
	const { run, progress, onStatus = () => {} } = deps;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let running: Promise<void> | null = null;
	/** A change came in while a backup was running: it needs one of its own. */
	let changedMeanwhile = false;
	let paused = false;
	let stopped = false;
	let failures = 0;

	function schedule(ms: number) {
		if (stopped) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void attempt().catch(() => {});
		}, ms);
	}

	function pending(): boolean {
		return progress.load().pendingSince !== null;
	}

	function attempt(): Promise<void> {
		if (running) return running;
		if (timer) clearTimeout(timer);
		timer = null;
		const startedAt = Date.now();
		changedMeanwhile = false;
		onStatus({ kind: 'running' });
		running = (async () => {
			try {
				await run();
				failures = 0;
				paused = false;
				progress.save({
					lastUploadAt: new Date(startedAt).toISOString(),
					pendingSince: changedMeanwhile ? new Date().toISOString() : null
				});
				onStatus({ kind: 'idle' });
				if (changedMeanwhile) schedule(QUIET_MS);
			} catch (err) {
				const code = codeOf(err);
				const retrying = code === 'CLOUD_UNAVAILABLE';
				paused = code !== undefined && NEEDS_USER.has(code);
				onStatus({ kind: 'failed', error: err, retrying });
				if (retrying) schedule(RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
				throw err;
			} finally {
				running = null;
			}
		})();
		return running;
	}

	/** Runs unless paused or stopped, keeping errors in the status. */
	function auto() {
		if (!stopped && !paused) void attempt().catch(() => {});
	}

	return {
		start() {
			const { lastUploadAt, pendingSince } = progress.load();
			const last = lastUploadAt ? Date.parse(lastUploadAt) : NaN;
			if (pendingSince || !(Date.now() - last < STALE_MS)) schedule(START_DELAY_MS);
		},
		changed(tables) {
			if (stopped) return;
			// markBackedUp records the backup in each budget's meta while it runs.
			if (running && tables.every((t) => t === 'meta')) return;
			if (running) changedMeanwhile = true;
			const saved = progress.load();
			if (!saved.pendingSince) progress.save({ ...saved, pendingSince: new Date().toISOString() });
			if (!paused && !running) schedule(QUIET_MS);
		},
		flush() {
			if (pending()) auto();
		},
		online() {
			if (pending() || failures > 0) auto();
		},
		resume() {
			paused = false;
			const { lastUploadAt, pendingSince } = progress.load();
			if (pendingSince || !lastUploadAt) auto();
		},
		runNow() {
			return attempt();
		},
		stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
			timer = null;
		}
	};
}
