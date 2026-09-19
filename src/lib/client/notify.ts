import { toast } from 'svelte-sonner';
import { errorDetails, errorMessage, isUnexpected } from '$lib/i18n/errors';
import { m } from '$lib/paraglide/messages';

/** Shows an unexpected error as a toast with a "copy details" action. */
export function notifyError(err: unknown): void {
	toast.error(errorMessage(err), {
		action: {
			label: m.copy_details(),
			onClick: () => void navigator.clipboard?.writeText(errorDetails(err))
		}
	});
}

/**
 * Runs a write for a form. Returns null on success, or the message to show inline.
 * Unexpected errors are also reported with a toast.
 */
export async function runAction(fn: () => Promise<unknown>): Promise<string | null> {
	try {
		await fn();
		return null;
	} catch (err) {
		if (isUnexpected(err)) notifyError(err);
		return errorMessage(err);
	}
}
