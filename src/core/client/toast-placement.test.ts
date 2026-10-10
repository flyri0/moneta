import { describe, expect, it } from 'vitest';
import { toastPlacement } from './toast-placement';

describe('toastPlacement', () => {
	it('keeps desktop at the bottom right', () => {
		expect(toastPlacement({ desktop: true, drawers: 1, pickers: 1 })).toEqual({
			position: 'bottom-right',
			swipeDirections: ['right', 'bottom']
		});
	});

	it('puts phone toasts above the bottom bar, at the top over a drawer, low over a picker', () => {
		expect(toastPlacement({ desktop: false, drawers: 0, pickers: 0 })).toEqual({
			position: 'bottom-center',
			offset: { bottom: 'calc(var(--app-bottom, env(safe-area-inset-bottom)) + 0.75rem)' },
			swipeDirections: ['left', 'right', 'bottom']
		});
		expect(toastPlacement({ desktop: false, drawers: 1, pickers: 0 })).toEqual({
			position: 'top-center',
			offset: { top: 'calc(var(--app-top, env(safe-area-inset-top)) + 0.75rem)' },
			swipeDirections: ['left', 'right', 'top']
		});
		expect(toastPlacement({ desktop: false, drawers: 1, pickers: 1 })).toEqual({
			position: 'bottom-center',
			offset: { bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' },
			swipeDirections: ['left', 'right', 'bottom']
		});
	});
});
