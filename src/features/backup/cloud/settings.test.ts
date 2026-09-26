import { describe, it, expect } from 'vitest';
import { memoryStore, brokenStore } from '$client/testing';
import {
	CLOUD_KEY,
	deviceLabel,
	loadCloudSettings,
	newCloudSettings,
	saveCloudSettings
} from './settings';

describe('cloud settings', () => {
	it('are saved per device and read back', () => {
		const store = memoryStore();
		expect(loadCloudSettings(store)).toBeNull();
		const settings = newCloudSettings(
			'google-drive',
			'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0'
		);
		expect(settings).toMatchObject({
			provider: 'google-drive',
			deviceLabel: 'Firefox · Linux',
			lastUploadAt: null,
			pendingSince: null
		});
		expect(settings.device).toMatch(/^[0-9a-f-]{36}$/);
		saveCloudSettings(store, settings);
		expect(loadCloudSettings(store)).toEqual(settings);
		saveCloudSettings(store, null);
		expect(store.getItem(CLOUD_KEY)).toBeNull();
	});

	it('ignore what they cannot read', () => {
		const store = memoryStore();
		store.setItem(CLOUD_KEY, '{');
		expect(loadCloudSettings(store)).toBeNull();
		store.setItem(CLOUD_KEY, JSON.stringify({ provider: 'ftp', device: 'x' }));
		expect(loadCloudSettings(store)).toBeNull();
		expect(loadCloudSettings(brokenStore())).toBeNull();
		expect(() => saveCloudSettings(brokenStore(), null)).not.toThrow();
	});
});

describe('deviceLabel', () => {
	it('names the browser and the system', () => {
		const cases: [string, string][] = [
			[
				'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
				'Chrome · Android'
			],
			[
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
				'Safari · iOS'
			],
			[
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
				'Edge · Windows'
			],
			[
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
				'Chrome · macOS'
			],
			[
				'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
				'Samsung Internet · Android'
			],
			['curl/8.0', 'Browser']
		];
		for (const [ua, label] of cases) expect(deviceLabel(ua), ua).toBe(label);
	});
});
