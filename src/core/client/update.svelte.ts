import { applyServiceWorkerUpdate, checkForUpdate, onUpdateStatus, type UpdateStatus } from './sw';

/**
 * App updates for the screens: the status reported by the service worker, a check asked for by
 * hand and the way to install a waiting version. `Boot` starts it and says how to install, since
 * the database must close first.
 */
class AppUpdate {
	status: UpdateStatus = $state('idle');

	#install: () => Promise<void> = applyServiceWorkerUpdate;

	/** Follows the service worker's status; `install` replaces the plain install. Returns a stop. */
	start(install: () => Promise<void>): () => void {
		this.#install = install;
		return onUpdateStatus((status) => (this.status = status));
	}

	/** Looks for a new version now. */
	check(): Promise<void> {
		return checkForUpdate();
	}

	/** Installs the waiting version, which reloads the app. */
	install(): Promise<void> {
		return this.#install();
	}
}

export const appUpdate = new AppUpdate();
