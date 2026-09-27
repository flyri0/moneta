import type { KeyValueStore } from './registry';

/** Whether the app follows the system's motion preference or always keeps motion down. */
export type MotionSetting = 'system' | 'reduce';

/** Where this device keeps the motion setting. */
export const MOTION_KEY = 'moneta.motion';

export function readMotion(store: KeyValueStore): MotionSetting {
	try {
		return store.getItem(MOTION_KEY) === 'reduce' ? 'reduce' : 'system';
	} catch {
		return 'system';
	}
}

export function writeMotion(store: KeyValueStore, setting: MotionSetting): void {
	try {
		if (setting === 'reduce') store.setItem(MOTION_KEY, 'reduce');
		else store.removeItem(MOTION_KEY);
	} catch {
		// Storage can be full or blocked; the choice lasts until the page closes.
	}
}

/** Motion is reduced when chosen here or asked for by the system: never against the system. */
export function isReduced(setting: MotionSetting, systemReduces: boolean): boolean {
	return setting === 'reduce' || systemReduces;
}
