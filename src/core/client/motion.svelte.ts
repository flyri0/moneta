import { MediaQuery } from 'svelte/reactivity';
import { isReduced, readMotion, writeMotion, type MotionSetting } from './motion';

const system = new MediaQuery('(prefers-reduced-motion: reduce)');
let setting = $state<MotionSetting>(readMotion(localStorage));

/**
 * The motion preference on this device. `reduced` drives `data-motion` on the document, which
 * turns CSS animations and transitions off; animations run from script ask `motionDuration`.
 */
export const motion = {
	get setting(): MotionSetting {
		return setting;
	},
	set(next: MotionSetting): void {
		setting = next;
		writeMotion(localStorage, next);
	},
	get reduced(): boolean {
		return isReduced(setting, system.current);
	}
};

/** `ms`, or 0 when motion is reduced: for animations run from script (`flip`, `el.animate`). */
export function motionDuration(ms: number): number {
	return motion.reduced ? 0 : ms;
}
