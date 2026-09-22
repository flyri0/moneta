import { toast } from 'svelte-sonner';
import { errorDetails, errorMessage, isUnexpected } from '$i18n/errors';
import { m } from '$i18n/paraglide/messages';

/** Shows an unexpected error as a toast with a "copy details" action. */
export function notifyError(err: unknown): void {
	toast.error(errorMessage(err), {
		action: {
			label: m.copy_details(),
			onClick: () => void copyDetails(err)
		}
	});
}

/** Copies an error's details for a bug report, and says whether that worked. */
export async function copyDetails(err: unknown): Promise<void> {
	try {
		// Missing outside a secure context; writeText also rejects when permission is denied.
		if (!navigator.clipboard) throw new Error('No clipboard');
		await navigator.clipboard.writeText(errorDetails(err));
		toast.success(m.copy_details_done());
	} catch {
		toast.error(m.copy_details_failed());
	}
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

/**
 * Runs a write with no inline error display of its own: every failure is reported with a
 * single toast (unexpected errors get the "copy details" action, expected ones a plain message).
 */
export async function runActionToast(fn: () => Promise<unknown>): Promise<void> {
	try {
		await fn();
	} catch (err) {
		if (isUnexpected(err)) notifyError(err);
		else toast.error(errorMessage(err));
	}
}
