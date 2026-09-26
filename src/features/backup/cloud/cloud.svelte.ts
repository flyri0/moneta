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
import type { CloudConnection, CloudProvider, CloudProviderId } from './provider';

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
	#auto: AutoBackup | null = null;
	#loading: Promise<void> | null = null;

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
		void this.load().then(() => this.connection && auto.start());
		return () => {
			auto.stop();
			if (this.#auto === auto) this.#auto = null;
			offChange();
			document.removeEventListener('visibilitychange', onHidden);
			window.removeEventListener('online', onOnline);
		};
	}

	async #run(api: Pick<ClientApi, 'system'>): Promise<void> {
		await this.load();
		const { connection, settings } = this;
		if (!connection || !settings) throw new DomainError('CLOUD_AUTH_NEEDED');
		await backUpToCloud(api, connection, settings);
	}

	#save(settings: CloudSettings | null) {
		this.settings = settings;
		saveCloudSettings(localStorage, settings);
	}
}

export const cloudBackup = new CloudBackup();

/** Forgets every cloud connection on this device, for wiping it. Access lapses unused. */
export async function forgetCloud(): Promise<void> {
	await cloudBackup.disconnect().catch(() => {});
	await deleteAuthDb().catch(() => {});
}
