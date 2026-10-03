import type { RpcClient } from '$client/rpc';
import type { ClientApi } from '$db/api';
import { DomainError } from '$domain/errors';
import { autoBackup, type AutoBackup, type AutoBackupStatus } from './auto-backup';
import { backUpToCloud } from './cloud-backup';
import { googleDrive } from './google-drive';
import {
	loadCloudSettings,
	newCloudSettings,
	saveCloudSettings,
	type CloudSettings
} from './settings';
import { deleteAuthDb, idbAuthStore } from './tokens';
import type { CloudConnection, CloudProvider, CloudProviderId, RemoteBackup } from './provider';
import { adopted, compareRemote, keptOver, nextRevision, type RemoteState } from './revision';
import { isBudgetFile } from '$client/registry';

/** The providers this build knows; `available()` says which have a client id. */
const PROVIDERS: CloudProvider[] = [
	googleDrive({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID, store: idbAuthStore() })
];

/** The providers this build can use. */
export function cloudProviders(): CloudProvider[] {
	return PROVIDERS.filter((p) => p.available());
}

function providerOf(id: CloudProviderId): CloudProvider | undefined {
	return PROVIDERS.find((p) => p.id === id && p.available());
}

/**
 * The cloud backup of this device, for the screens: which provider, whose account, how the last
 * backup went. The tab holding the database attaches it to the open session (`attach`), which
 * runs backups by themselves.
 */
class CloudBackup {
	settings = $state<CloudSettings | null>(null);
	connection = $state.raw<CloudConnection | null>(null);
	status = $state.raw<AutoBackupStatus>({ kind: 'idle' });
	/** Whether the saved connection has been read yet. */
	loaded = $state(false);
	/** How this device stands against the others' backups, as checked when the app opened. */
	remote = $state.raw<RemoteState>({ kind: 'current' });
	#auto: AutoBackup | null = null;
	#loading: Promise<void> | null = null;
	/** The cloud backup last downloaded to restore, until it is restored. */
	#picked: { file: File; backup: RemoteBackup } | null = null;

	get provider(): CloudProvider | undefined {
		return this.settings ? providerOf(this.settings.provider) : undefined;
	}

	/** Reads the connection saved on this device. A connection whose tokens are gone needs a sign-in. */
	load(): Promise<void> {
		this.#loading ??= (async () => {
			this.settings = loadCloudSettings(localStorage);
			const provider = this.provider;
			try {
				this.connection = provider ? await provider.resume() : null;
			} catch {
				this.connection = null;
			}
			if (this.settings && !this.connection)
				this.status = {
					kind: 'failed',
					error: new DomainError('CLOUD_AUTH_NEEDED'),
					retrying: false
				};
			this.loaded = true;
		})();
		return this.#loading;
	}

	/**
	 * Signs in and turns automatic backups on. Call it straight from a click: the provider opens
	 * its popup before anything is awaited. Returns false when the user cancelled.
	 */
	async connect(provider: CloudProvider, signal?: AbortSignal): Promise<boolean> {
		const connection = await provider.connect(signal);
		if (!connection) return false;
		// Reconnecting keeps the device's id, so its backups still rotate together.
		const settings =
			this.settings?.provider === provider.id
				? this.settings
				: newCloudSettings(provider.id, navigator.userAgent);
		this.#save(settings);
		this.connection = connection;
		this.status = { kind: 'idle' };
		this.loaded = true;
		// Before the backup that follows, as at start.
		await this.check();
		this.#auto?.resume();
		return true;
	}

	/** Revokes access and turns automatic backups off. The backups already saved stay there. */
	async disconnect(): Promise<void> {
		const connection = this.connection;
		this.#save(null);
		this.connection = null;
		this.status = { kind: 'idle' };
		await connection?.disconnect();
	}

	/** Backs up now, for a button; rejects with the error. */
	backUpNow(api: Pick<ClientApi, 'system'>): Promise<void> {
		return this.#auto?.runNow() ?? this.#run(api);
	}

	/** The user fixed what paused backups (e.g. turned encryption back on). */
	resume(): void {
		this.#auto?.resume();
	}

	/**
	 * Runs backups by themselves for the open session, until the returned function is called:
	 * after changes, when the page is hidden, when back online, and at start when due.
	 */
	attach(client: Pick<RpcClient, 'api' | 'onChange'>): () => void {
		const auto = autoBackup({
			run: () => this.#run(client.api),
			progress: {
				load: () => ({
					lastUploadAt: this.settings?.lastUploadAt ?? null,
					pendingSince: this.settings?.pendingSince ?? null
				}),
				save: (progress) => this.settings && this.#save({ ...this.settings, ...progress })
			},
			onStatus: (status) => (this.status = status)
		});
		this.#auto = auto;
		const offChange = client.onChange((tables) => this.settings && auto.changed(tables));
		const onHidden = () => document.visibilityState === 'hidden' && auto.flush();
		const onOnline = () => auto.online();
		document.addEventListener('visibilitychange', onHidden);
		window.addEventListener('online', onOnline);
		void this.load().then(async () => {
			if (!this.connection) return;
			// Before the first backup, which may change this device's revision.
			await this.check();
			auto.start();
		});
		return () => {
			auto.stop();
			if (this.#auto === auto) this.#auto = null;
			offChange();
			document.removeEventListener('visibilitychange', onHidden);
			window.removeEventListener('online', onOnline);
		};
	}

	/**
	 * Lists the backups once and compares this device's revision with the others'. Best effort: a
	 * failure leaves the notice as it was.
	 */
	async check(): Promise<void> {
		const { connection, settings } = this;
		if (!connection || !settings) return;
		try {
			const backups = await connection.list();
			// Settings read again: a backup or a restore may have changed them meanwhile.
			const now = this.settings;
			if (!now || this.connection !== connection) return;
			this.remote = compareRemote(now.revision, now.pendingSince !== null, backups, now.device);
		} catch {
			// The notice waits for the next start.
		}
	}

	/** Downloads a cloud backup to restore, remembering it so a full restore adopts its revision. */
	async download(backup: RemoteBackup): Promise<File> {
		const connection = this.connection;
		if (!connection) throw new DomainError('CLOUD_AUTH_NEEDED');
		const file = new File([await connection.download(backup.id)], backup.name);
		this.#picked = { file, backup };
		return file;
	}

	/**
	 * After a restore from `source` succeeded. When it was the cloud backup just downloaded, every
	 * budget of it was restored (`all`) and this device now holds exactly those budgets (`files`),
	 * this device takes its revision: it has nothing of its own. Otherwise the data changed here,
	 * and waits for a backup like any change.
	 */
	async restored(
		api: Pick<ClientApi, 'system'>,
		restore: { source: File | null; all: boolean; files: readonly string[] }
	): Promise<void> {
		const picked = this.#picked;
		this.#picked = null;
		await this.load();
		const settings = this.settings;
		if (!settings) return;
		const revision = picked?.file === restore.source ? picked.backup.revision : null;
		let same = false;
		if (revision && restore.all) {
			const here = (await api.system.listFiles()).filter(isBudgetFile);
			same = here.length === restore.files.length && here.every((f) => restore.files.includes(f));
		}
		const now = this.settings ?? settings;
		if (revision && same) {
			this.#save({ ...now, revision: adopted(revision), pendingSince: null });
			this.remote = { kind: 'current' };
		} else if (!now.pendingSince) {
			this.#save({ ...now, pendingSince: new Date().toISOString() });
		}
	}

	/**
	 * Keeps this device's version over the other device's: this one stops warning, and the other
	 * is warned that the versions differ once this one is backed up, which happens next.
	 */
	keepThisVersion(): void {
		const { settings, remote } = this;
		if (!settings || remote.kind === 'current' || !remote.backup.revision) return;
		this.#save({
			...settings,
			revision: keptOver(settings.revision, remote.backup.revision),
			pendingSince: settings.pendingSince ?? new Date().toISOString()
		});
		this.remote = { kind: 'current' };
		this.#auto?.changed([]);
	}

	/** Hides the notice until the app opens again. */
	dismiss(): void {
		this.remote = { kind: 'current' };
	}

	async #run(api: Pick<ClientApi, 'system'>): Promise<void> {
		await this.load();
		const { connection, settings } = this;
		if (!connection || !settings) throw new DomainError('CLOUD_AUTH_NEEDED');
		const revision = nextRevision(settings.revision, settings.pendingSince !== null);
		const { device, deviceLabel } = settings;
		await backUpToCloud(api, connection, { device, deviceLabel, revision });
		// Unless a restore or "keep this version" set another one meanwhile.
		if (this.settings && this.settings.revision === settings.revision)
			this.#save({ ...this.settings, revision });
	}

	#save(settings: CloudSettings | null) {
		this.settings = settings;
		saveCloudSettings(localStorage, settings);
	}
}

export const cloudBackup = new CloudBackup();

/** Forgets every cloud connection on this device, for wiping it. Access lapses unused. */
export async function forgetCloud(): Promise<void> {
	// Loaded first: without its connection there is no refresh token to revoke.
	await cloudBackup.load();
	await cloudBackup.disconnect().catch(() => {});
	await deleteAuthDb().catch(() => {});
}
