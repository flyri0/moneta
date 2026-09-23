import type { KeyValueStore } from './registry';

/** The app's version, from package.json at build time. */
export const APP_VERSION: string = __APP_VERSION__;

/** The source repository, where each release's notes live. */
export const REPOSITORY_URL = 'https://github.com/flyri0/moneta';

/** Remembers the version that last ran here, to notice an update after the reload. */
export const LAST_VERSION_KEY = 'moneta.lastVersion';

/** The GitHub release for `version`: its notes are the changelog. */
export function releaseUrl(version: string): string {
	return `${REPOSITORY_URL}/releases/tag/v${version}`;
}

/**
 * Records `current` as the version that ran here and returns it when a different one ran before:
 * the app was just updated. On the first run, or with storage blocked, returns null.
 */
export function takeUpdatedVersion(store: KeyValueStore, current: string): string | null {
	try {
		const last = store.getItem(LAST_VERSION_KEY);
		if (last === current) return null;
		store.setItem(LAST_VERSION_KEY, current);
		return last === null ? null : current;
	} catch {
		return null;
	}
}
