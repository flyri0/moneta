/** How long a just-saved transaction stays marked, a little longer than its highlight runs. */
const FRESH_MS = 1600;

let id = $state<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** The transaction just saved, which its register row highlights. */
export const fresh = {
	get id(): string | null {
		return id;
	}
};

/** Marks `transactionId` as just saved, for a moment. */
export function markFresh(transactionId: string): void {
	clearTimeout(timer);
	id = transactionId;
	timer = setTimeout(() => (id = null), FRESH_MS);
}
