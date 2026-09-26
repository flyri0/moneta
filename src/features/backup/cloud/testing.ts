/** Test helpers for cloud backups: a fake Google Drive, and sign-ins that answer at once. */
import { fakeDrive } from './fake-drive';
import { googleDrive } from './google-drive';
import type { CallbackMessage, SignInDeps } from './oauth';
import { memoryAuthStore } from './tokens';

export { fakeDrive };

/** A sign-in popup that answers at once with `reply`, as the callback page would. */
export function answeringPopup(
	reply: Omit<CallbackMessage, 'state'> = { code: 'code' }
): () => SignInDeps {
	return () => {
		let onMessage: (message: CallbackMessage) => void = () => {};
		const win = {
			location: {
				set href(url: string) {
					const state = new URL(url).searchParams.get('state') ?? '';
					queueMicrotask(() => onMessage({ state, ...reply }));
				},
				get href() {
					return '';
				}
			},
			close() {}
		};
		return {
			open: () => win,
			listen(listener) {
				onMessage = listener;
				return () => {};
			},
			redirectUri: 'https://moneta.example/oauth/callback',
			timeoutMs: 1000
		};
	};
}

/** Google Drive against a fake one, signed in. */
export async function connectedDrive(drive = fakeDrive()) {
	const provider = googleDrive({
		clientId: 'client-id',
		store: memoryAuthStore(),
		fetcher: drive.fetcher,
		signInDeps: answeringPopup()
	});
	const connection = await provider.connect();
	if (!connection) throw new Error('The fake sign-in was refused');
	return { drive, provider, connection };
}
