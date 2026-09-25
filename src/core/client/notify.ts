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

/**
 * Reports errors and promise rejections that nothing caught (`error` and `unhandledrejection` on
 * the window) with `notifyError`, so a failure never goes unseen. Returns the function that stops.
 */
export function watchUncaught(target: EventTarget): () => void {
	const onError = (event: Event) => {
		const { error, message } = event as ErrorEvent;
		// Chromium reports a ResizeObserver that couldn't deliver in one frame; nothing failed.
		if (typeof message === 'string' && message.startsWith('ResizeObserver loop')) return;
		notifyError(error ?? message);
	};
	const onRejection = (event: Event) => notifyError((event as PromiseRejectionEvent).reason);
	target.addEventListener('error', onError);
	target.addEventListener('unhandledrejection', onRejection);
	return () => {
		target.removeEventListener('error', onError);
		target.removeEventListener('unhandledrejection', onRejection);
	};
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

/** A failed write, as a form shows it. `cause` is set only for unexpected errors (a bug report). */
export interface ActionError {
	message: string;
	cause?: unknown;
}

/** The inline form of an error: its message, and the error itself when it is unexpected. */
export function actionError(err: unknown): ActionError {
	return isUnexpected(err)
		? { message: errorMessage(err), cause: err }
		: { message: errorMessage(err) };
}

/**
 * Runs a write for a form. Returns null on success, or the error to show inline (unexpected
 * errors carry their cause, for the inline "copy details" action).
 */
export async function runAction(fn: () => Promise<unknown>): Promise<ActionError | null> {
	try {
		await fn();
		return null;
	} catch (err) {
		return actionError(err);
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
