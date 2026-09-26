import { DomainError } from '$domain/errors';
import { requestToken, signIn, type SignInDeps } from './oauth';
import { accessTokens, type AccessTokens, type AuthStore } from './tokens';
import type { BackupFileInfo, CloudConnection, CloudProvider, RemoteBackup } from './provider';

/**
 * Google Drive, through its REST API. The `drive.file` scope only reaches files Moneta created:
 * a visible "Moneta" folder with the backups in it, which the user can open, download or delete
 * in Drive. Files are found by their `appProperties`, so moving or renaming them changes nothing.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
/** The token proxy's name for Google. */
const PROVIDER = 'google';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const FOLDER_TYPE = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,size,modifiedTime,appProperties';

interface DriveFile {
	id: string;
	name: string;
	size?: string;
	modifiedTime: string;
	appProperties?: Record<string, string>;
}

/** Why Drive refused a call, as a CLOUD_* error. */
async function driveError(res: Response): Promise<DomainError> {
	let body: { error?: { errors?: { reason?: string }[]; message?: string } } = {};
	try {
		body = await res.json();
	} catch {
		// Not JSON: the status says enough.
	}
	const reason = body.error?.errors?.[0]?.reason;
	const detail = `Google Drive answered ${res.status}${reason ? ` (${reason})` : ''}`;
	if (res.status === 401) return new DomainError('CLOUD_AUTH_NEEDED', detail);
	if (reason === 'storageQuotaExceeded') return new DomainError('CLOUD_STORAGE_FULL', detail);
	if (res.status === 429 || res.status >= 500 || reason?.endsWith('RateLimitExceeded'))
		return new DomainError('CLOUD_UNAVAILABLE', detail);
	if (reason === 'insufficientPermissions' || reason === 'insufficientScopes')
		return new DomainError('CLOUD_PERMISSION_DENIED', detail);
	return new DomainError('CLOUD_FAILED', detail, body);
}

/**
 * Drive calls with the connection's token; a refused token is renewed once. Statuses in `accept`
 * are answers, not errors.
 */
function driveFetch(tokens: AccessTokens, fetcher: typeof fetch) {
	return async function call(
		url: string,
		init: RequestInit = {},
		accept: number[] = []
	): Promise<Response> {
		for (let attempt = 0; ; attempt++) {
			const token = attempt === 0 ? await tokens.get() : await tokens.renew();
			let res: Response;
			try {
				res = await fetcher(url, {
					...init,
					headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${token}` }
				});
			} catch (err) {
				throw new DomainError('CLOUD_UNAVAILABLE', String(err));
			}
			if (res.ok || accept.includes(res.status)) return res;
			if (res.status === 401 && attempt === 0) continue;
			throw await driveError(res);
		}
	};
}

function query(conditions: string[]): string {
	return conditions.join(' and ');
}

/** A condition on an app property. Values are ids and dates Moneta made, but quote them anyway. */
function hasProperty(key: string, value: string): string {
	const quoted = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	return `appProperties has { key='${key}' and value='${quoted}' }`;
}

function toRemote(file: DriveFile): RemoteBackup {
	const props = file.appProperties ?? {};
	return {
		id: file.id,
		name: file.name,
		day: props.day ?? file.modifiedTime.slice(0, 10),
		device: props.device ?? '',
		deviceLabel: props.deviceLabel ?? '',
		modifiedAt: file.modifiedTime,
		size: Number(file.size ?? 0)
	};
}

/** A multipart upload body: the file's metadata, then its content. */
function multipart(metadata: object, data: Blob): { body: Blob; type: string } {
	const boundary = `moneta-${crypto.randomUUID()}`;
	const body = new Blob([
		`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
		JSON.stringify(metadata),
		`\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
		data,
		`\r\n--${boundary}--`
	]);
	return { body, type: `multipart/related; boundary=${boundary}` };
}

function driveConnection(
	account: string,
	tokens: AccessTokens,
	store: AuthStore,
	fetcher: typeof fetch
): CloudConnection {
	const call = driveFetch(tokens, fetcher);

	async function find(conditions: string[]): Promise<DriveFile[]> {
		const found: DriveFile[] = [];
		let page: string | undefined;
		do {
			const url = new URL(`${API}/files`);
			url.searchParams.set('q', query([...conditions, 'trashed = false']));
			url.searchParams.set('fields', `nextPageToken,files(${FILE_FIELDS})`);
			url.searchParams.set('orderBy', 'modifiedTime desc');
			url.searchParams.set('pageSize', '100');
			if (page) url.searchParams.set('pageToken', page);
			const res = (await (await call(url.toString())).json()) as {
				files: DriveFile[];
				nextPageToken?: string;
			};
			found.push(...res.files);
			page = res.nextPageToken;
		} while (page);
		return found;
	}

	/** The "Moneta" folder Moneta made, made now if it isn't there (or was deleted). */
	async function folder(): Promise<string> {
		const [existing] = await find([`mimeType = '${FOLDER_TYPE}'`, hasProperty('moneta', 'folder')]);
		if (existing) return existing.id;
		const res = await call(`${API}/files?fields=id`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'Moneta',
				mimeType: FOLDER_TYPE,
				appProperties: { moneta: 'folder' }
			})
		});
		return ((await res.json()) as { id: string }).id;
	}

	const backups = [hasProperty('moneta', 'backup')];

	return {
		provider: 'google-drive',
		account,
		async upload(info: BackupFileInfo, data: Blob) {
			const appProperties = {
				moneta: 'backup',
				day: info.day,
				device: info.device,
				deviceLabel: info.deviceLabel
			};
			const [today] = await find([
				...backups,
				hasProperty('day', info.day),
				hasProperty('device', info.device)
			]);
			const { body, type } = today
				? multipart({ name: info.name, appProperties }, data)
				: multipart({ name: info.name, appProperties, parents: [await folder()] }, data);
			const res = await call(
				today
					? `${UPLOAD}/files/${today.id}?uploadType=multipart&fields=${FILE_FIELDS}`
					: `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
				{ method: today ? 'PATCH' : 'POST', headers: { 'content-type': type }, body }
			);
			return toRemote((await res.json()) as DriveFile);
		},
		async list() {
			return (await find(backups)).map(toRemote);
		},
		async download(id) {
			return (await call(`${API}/files/${encodeURIComponent(id)}?alt=media`)).blob();
		},
		async remove(id) {
			// A 404 means it is already gone: deleted in Drive, or by another tab's rotation.
			await call(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' }, [404]);
		},
		async disconnect() {
			const auth = await store.get(PROVIDER);
			await store.delete(PROVIDER);
			if (!auth) return;
			// Best effort: once forgotten here, the access is unused and lapses anyway.
			await fetcher(REVOKE, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ token: auth.refreshToken }).toString()
			}).catch(() => {});
		}
	};
}

/** Google Drive, when this build has a client id (`VITE_GOOGLE_CLIENT_ID`). */
export function googleDrive(options: {
	clientId: string | undefined;
	store: AuthStore;
	fetcher?: typeof fetch;
	signInDeps?: () => SignInDeps;
	now?: () => number;
}): CloudProvider {
	const { clientId, store, signInDeps, now = Date.now } = options;
	// Called through a wrapper so a test's (or the page's) current fetch is used.
	const fetcher: typeof fetch = (input, init) => (options.fetcher ?? fetch)(input, init);
	const request = (provider: string, req: Parameters<typeof requestToken>[1]) =>
		requestToken(provider, req, fetcher, now());
	const tokens = () => accessTokens(PROVIDER, store, { request, now });

	return {
		id: 'google-drive',
		name: 'Google Drive',
		available: () => Boolean(clientId),
		async connect(signal) {
			if (!clientId) throw new DomainError('CLOUD_FAILED', 'No Google client id in this build');
			const signedIn = await signIn(
				{
					provider: PROVIDER,
					authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
					clientId,
					scope: DRIVE_SCOPE,
					// A refresh token, every time: `consent` makes Google send a new one.
					params: { access_type: 'offline', prompt: 'consent' }
				},
				signInDeps?.(),
				signal
			);
			if (!signedIn) return null;
			const grant = await request(PROVIDER, {
				grant: 'authorization_code',
				code: signedIn.code,
				codeVerifier: signedIn.verifier
			});
			// Google lets the user untick the Drive permission on the consent screen.
			if (!grant.scope?.split(' ').includes(DRIVE_SCOPE))
				throw new DomainError('CLOUD_PERMISSION_DENIED');
			if (!grant.refreshToken)
				throw new DomainError('CLOUD_FAILED', 'Google sent no refresh token');
			const auth = {
				refreshToken: grant.refreshToken,
				accessToken: grant.accessToken,
				expiresAt: grant.expiresAt,
				account: ''
			};
			await store.set(PROVIDER, auth);
			try {
				const call = driveFetch(tokens(), fetcher);
				const about = (await (
					await call(`${API}/about?fields=user(emailAddress,displayName)`)
				).json()) as {
					user?: { emailAddress?: string; displayName?: string };
				};
				auth.account = about.user?.emailAddress ?? about.user?.displayName ?? '';
				await store.set(PROVIDER, auth);
			} catch (err) {
				await store.delete(PROVIDER);
				throw err;
			}
			return driveConnection(auth.account, tokens(), store, fetcher);
		},
		async resume() {
			if (!clientId) return null;
			const auth = await store.get(PROVIDER);
			return auth ? driveConnection(auth.account, tokens(), store, fetcher) : null;
		}
	};
}
