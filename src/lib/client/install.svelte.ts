import { browser } from '$app/environment';

/** Chromium's install prompt event. It is not in lib.dom, so it is described here. */
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * The browser's offer to install the app. Chromium fires `beforeinstallprompt` once, early, and
 * often before any component is mounted, so the listeners are attached when this module loads
 * (the root layout imports it) and the event is kept until someone asks for it.
 */
class InstallPrompt {
	/** Whether the browser offered a one-tap install. */
	available = $state(false);
	/** Whether the app was installed while this page was open. */
	installed = $state(false);

	#event: BeforeInstallPromptEvent | null = null;

	listen(): void {
		window.addEventListener('beforeinstallprompt', (event) => {
			event.preventDefault();
			this.#event = event as BeforeInstallPromptEvent;
			this.available = true;
		});
		window.addEventListener('appinstalled', () => {
			this.#event = null;
			this.available = false;
			this.installed = true;
		});
	}

	/** Shows the browser's install dialog. The offer is spent either way. */
	async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
		const event = this.#event;
		if (!event) return 'unavailable';
		this.#event = null;
		this.available = false;
		await event.prompt();
		const { outcome } = await event.userChoice;
		if (outcome === 'accepted') this.installed = true;
		return outcome;
	}
}

export const install = new InstallPrompt();

if (browser) install.listen();
