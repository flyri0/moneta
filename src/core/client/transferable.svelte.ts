/**
 * Copies Svelte state proxies into plain values that postMessage can clone. Bytes (a backup) go
 * as they are: snapshotting them would copy the whole buffer once more for nothing. postMessage
 * still copies them, since callers keep using theirs (to retry a password, then inspect).
 * This lives in a .svelte.ts module because $state.snapshot is a rune.
 */
export function toTransferable<T>(value: T): T {
	if (Array.isArray(value)) return value.map(snapshot) as T;
	return snapshot(value);
}

function snapshot<T>(value: T): T {
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
	return $state.snapshot(value) as T;
}
