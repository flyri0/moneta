/** How the user can install the app: the browser's own prompt, or steps they follow by hand. */
export type InstallHow = 'prompt' | 'ios' | 'safari' | 'firefox' | 'generic';

/** Whether the page is running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
	// iOS never implemented display-mode and marks its home-screen windows this way instead.
	return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Which install route to offer. Only Chromium fires `beforeinstallprompt`, so every other
 * browser gets instructions picked from its user agent.
 */
export function installHow(ua: string, promptable: boolean): InstallHow {
	if (promptable) return 'prompt';
	// Every iOS browser is Safari underneath, and all of them install through the share sheet.
	if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
	if (/Firefox\/|FxiOS/.test(ua)) return 'firefox';
	if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'safari';
	return 'generic';
}
