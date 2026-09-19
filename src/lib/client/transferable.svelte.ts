/**
 * Copies Svelte state proxies into plain values that postMessage can clone.
 * This lives in a .svelte.ts module because $state.snapshot is a rune.
 */
export function toTransferable<T>(value: T): T {
	return $state.snapshot(value) as T;
}
