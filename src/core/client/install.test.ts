import { describe, it, expect } from 'vitest';
import { installHow } from './install';

const UA = {
	chrome:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	android:
		'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
	iosSafari:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
	iosChrome:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
	iPad: 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
	macSafari:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
	firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0'
};

describe('installHow', () => {
	it('uses the browser prompt whenever one was offered', () => {
		expect(installHow(UA.chrome, true)).toBe('prompt');
		expect(installHow(UA.android, true)).toBe('prompt');
		// Even on a browser we have instructions for, a real prompt always wins.
		expect(installHow(UA.firefox, true)).toBe('prompt');
	});

	it('explains the share sheet on iOS, whichever browser is in front', () => {
		expect(installHow(UA.iosSafari, false)).toBe('ios');
		expect(installHow(UA.iosChrome, false)).toBe('ios');
		expect(installHow(UA.iPad, false)).toBe('ios');
	});

	it('explains the Dock on desktop Safari', () => {
		expect(installHow(UA.macSafari, false)).toBe('safari');
	});

	it('explains the menu on Firefox', () => {
		expect(installHow(UA.firefox, false)).toBe('firefox');
		expect(installHow(UA.firefoxAndroid, false)).toBe('firefox');
	});

	it('falls back to generic steps for anything else', () => {
		expect(installHow(UA.chrome, false)).toBe('generic');
		expect(installHow('', false)).toBe('generic');
	});
});
