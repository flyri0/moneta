import { createContext, untrack } from 'svelte';

import { goto } from '$app/navigation';

import type { BackLayer, MobileBack } from './mobile-back';

export const [getMobileBack, setMobileBack] = createContext<MobileBack | null>();

/** Register for the lifetime of an open layer, keeping callbacks current without reordering it. */
export function mobileBackLayer(open: () => boolean, layer: BackLayer): void {
	const controller = getMobileBack();
	if (!controller) return;
	$effect(() => {
		if (open()) return untrack(() => controller.register(layer));
	});
}

/** Preserve navigation options and its promise while disposing of mobile history first. */
export function layerNavigation(): typeof goto {
	const controller = getMobileBack();
	return async (url, options) => {
		if (controller?.protected) await controller.clear();
		// Callers supply URLs already resolved with $app/paths.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(url, options);
	};
}
