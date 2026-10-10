export interface ToastPlacement {
	position: 'bottom-right' | 'bottom-center' | 'top-center';
	offset?: { top?: string; bottom?: string };
}

/**
 * Where toasts go. On phones they sit above the bottom bar and the add button (`--app-bottom`),
 * at the top while a drawer is open (its buttons are at the bottom), and low while a full-screen
 * picker is open (its header is at the top).
 */
export function toastPlacement(s: {
	desktop: boolean;
	drawers: number;
	pickers: number;
}): ToastPlacement {
	if (s.desktop) return { position: 'bottom-right' };
	if (s.pickers > 0)
		return {
			position: 'bottom-center',
			offset: { bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }
		};
	if (s.drawers > 0)
		return {
			position: 'top-center',
			offset: { top: 'calc(var(--app-top, env(safe-area-inset-top)) + 0.75rem)' }
		};
	return {
		position: 'bottom-center',
		offset: { bottom: 'calc(var(--app-bottom, env(safe-area-inset-bottom)) + 0.75rem)' }
	};
}
