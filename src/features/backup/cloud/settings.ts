import { uuidv7 } from 'uuidv7';
import type { KeyValueStore } from '$client/registry';
import type { CloudProviderId } from './provider';

/** Where this device keeps its cloud backup settings (the tokens live in IndexedDB). */
export const CLOUD_KEY = 'moneta.cloud';

const PROVIDERS: readonly CloudProviderId[] = ['google-drive'];

/** The cloud backup of this device: where it goes, who it is, and how far it got. */
export interface CloudSettings {
	provider: CloudProviderId;
	/** A random id for this device, kept in each backup's properties for rotation. */
	device: string;
	deviceLabel: string;
	/** When the last backup was saved in the cloud (ISO). */
	lastUploadAt: string | null;
	/** Since when a change is waiting for a backup (ISO): it survives a closed tab. */
	pendingSince: string | null;
}

export function newCloudSettings(provider: CloudProviderId, userAgent: string): CloudSettings {
	return {
		provider,
		device: uuidv7(),
		deviceLabel: deviceLabel(userAgent),
		lastUploadAt: null,
		pendingSince: null
	};
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

export function loadCloudSettings(store: KeyValueStore): CloudSettings | null {
	try {
		const raw = JSON.parse(store.getItem(CLOUD_KEY) ?? 'null') as Partial<CloudSettings> | null;
		if (!raw || !PROVIDERS.includes(raw.provider as CloudProviderId)) return null;
		if (typeof raw.device !== 'string') return null;
		return {
			provider: raw.provider as CloudProviderId,
			device: raw.device,
			deviceLabel: typeof raw.deviceLabel === 'string' ? raw.deviceLabel : '',
			lastUploadAt: stringOrNull(raw.lastUploadAt),
			pendingSince: stringOrNull(raw.pendingSince)
		};
	} catch {
		return null;
	}
}

/** Saves the settings, or forgets them with null. Blocked storage keeps nothing, quietly. */
export function saveCloudSettings(store: KeyValueStore, settings: CloudSettings | null): void {
	try {
		if (settings) store.setItem(CLOUD_KEY, JSON.stringify(settings));
		else store.removeItem(CLOUD_KEY);
	} catch {
		// Nothing to do: the settings last as long as the page.
	}
}

const BROWSERS: [RegExp, string][] = [
	[/Edg(A|iOS)?\//, 'Edge'],
	[/SamsungBrowser\//, 'Samsung Internet'],
	[/OPR\//, 'Opera'],
	[/Firefox\/|FxiOS\//, 'Firefox'],
	[/Chrome\/|CriOS\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

const SYSTEMS: [RegExp, string][] = [
	[/Android/, 'Android'],
	[/iPhone|iPad|iPod/, 'iOS'],
	[/Windows/, 'Windows'],
	[/CrOS/, 'ChromeOS'],
	[/Mac OS X|Macintosh/, 'macOS'],
	[/Linux/, 'Linux']
];

/**
 * A name for this device that other devices can show, e.g. `Chrome · Android`. It is kept with
 * each backup in the cloud, so it isn't translated.
 */
export function deviceLabel(userAgent: string): string {
	const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'Browser';
	const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
	return system ? `${browser} · ${system}` : browser;
}
