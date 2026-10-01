import { toast } from 'svelte-sonner';
import { m } from '$i18n/paraglide/messages';
import { runActionToast } from './notify';
import type { RpcClient } from './rpc';

/** How long a toast offers to undo, in ms. */
const UNDO_DURATION = 10_000;

interface ToastButton {
	label: string;
	onClick: () => void;
}

/** The toast offering the latest undo: only that one can be taken back, so it replaces the last. */
let latest: string | number | undefined;

/**
 * Says what a write did, with an Undo button, once `call` (an undoable write, see `undo.ts` in
 * `$db`) has succeeded. A toast that has its own `action` gets Undo as its second button.
 */
export function offerUndo(
	client: RpcClient,
	call: Promise<unknown>,
	message: string,
	options: { action?: ToastButton; duration?: number } = {}
): void {
	if (latest !== undefined) toast.dismiss(latest);
	latest = undefined;
	const token = client.undoToken(call);
	if (!token) {
		toast.success(message, { action: options.action, duration: options.duration });
		return;
	}
	const undo: ToastButton = {
		label: m.undo(),
		onClick: () =>
			void runActionToast(async () => {
				await client.api.undo.apply(token);
				toast.success(m.undo_done());
			})
	};
	const duration = Math.max(options.duration ?? 0, UNDO_DURATION);
	latest = toast.success(
		message,
		options.action ? { duration, action: options.action, cancel: undo } : { duration, action: undo }
	);
}
