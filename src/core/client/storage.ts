/** A Storage kept in memory: what localStorage becomes when the browser won't hand it out. */
export function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		key: (i) => [...data.keys()][i] ?? null,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, String(v)),
		removeItem: (k) => void data.delete(k),
		clear: () => data.clear()
	};
}

/**
 * Makes `win.localStorage` safe to read. With site data blocked, or in a sandboxed iframe, merely
 * reading the property throws a SecurityError, before any try/catch around getItem or setItem can
 * help, and dependencies (Paraglide, mode-watcher) read it at import time. It is replaced with
 * a store in memory: the app still works, it just forgets its preferences between loads. Returns
 * whether it had to.
 */
export function ensureLocalStorage(win: { localStorage: Storage }): boolean {
	try {
		if (win.localStorage) return false;
	} catch {
		// Replaced below.
	}
	Object.defineProperty(win, 'localStorage', {
		configurable: true,
		enumerable: true,
		value: memoryStorage()
	});
	return true;
}
