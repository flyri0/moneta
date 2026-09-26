/**
 * Cloud storage for backups. Each provider (Google Drive today) signs in once and then saves,
 * lists and deletes backup files with nobody at the screen. What is saved is always an encrypted
 * `.moneta` file (`cloud-backup.ts`), so the provider never reads a budget.
 */

export type CloudProviderId = 'google-drive';

/** What a backup file says about itself, next to its content. */
export interface BackupFileInfo {
	name: string;
	/** The local day it was made, `YYYY-MM-DD`: a device keeps one file per day. */
	day: string;
	/** The device that made it (a random id), so rotation leaves other devices' files alone. */
	device: string;
	/** A readable name for that device, e.g. "Chrome on Android". */
	deviceLabel: string;
}

/** A backup saved in the cloud. */
export interface RemoteBackup extends BackupFileInfo {
	id: string;
	/** When it was last written (ISO). */
	modifiedAt: string;
	size: number;
}

/** A signed-in provider. Errors are DomainErrors with `CLOUD_*` codes. */
export interface CloudConnection {
	readonly provider: CloudProviderId;
	/** Whose storage it is, as the provider names the account. */
	readonly account: string;
	/** Saves a backup, replacing the file this device already saved that day. */
	upload(info: BackupFileInfo, data: Blob): Promise<RemoteBackup>;
	/** Every backup Moneta saved there, from any device, newest first. */
	list(): Promise<RemoteBackup[]>;
	download(id: string): Promise<Blob>;
	remove(id: string): Promise<void>;
	/** Revokes access where the provider allows it, and forgets the connection on this device. */
	disconnect(): Promise<void>;
}

export interface CloudProvider {
	readonly id: CloudProviderId;
	/** The product name, as the provider writes it. */
	readonly name: string;
	/** Whether this build can use it (its client id was set). */
	available(): boolean;
	/**
	 * Signs in and saves the connection. Call it straight from a click: it opens a popup first.
	 * Returns null when the user cancels or says no.
	 */
	connect(signal?: AbortSignal): Promise<CloudConnection | null>;
	/** The connection saved on this device, without asking anything; null when there is none. */
	resume(): Promise<CloudConnection | null>;
}
