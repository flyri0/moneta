/**
 * A fake Google Drive and token proxy, for unit tests and e2e tests (which answer the browser's
 * requests with it): enough of the REST API for the calls `google-drive.ts` makes, answered from
 * memory. It imports nothing, so Playwright can load it as is.
 */

export interface FakeFile {
	id: string;
	name: string;
	mimeType: string;
	parents: string[];
	appProperties: Record<string, string>;
	modifiedTime: string;
	content: Uint8Array<ArrayBuffer>;
	trashed: boolean;
}

function binary(bytes: Uint8Array): string {
	let text = '';
	for (const byte of bytes) text += String.fromCharCode(byte);
	return text;
}

function bytesOf(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

/** The metadata and the content of a multipart upload. */
async function readMultipart(
	req: Request
): Promise<{ metadata: Partial<FakeFile>; content: Uint8Array<ArrayBuffer> }> {
	const boundary = /boundary=(.+)$/.exec(req.headers.get('content-type') ?? '')?.[1];
	const text = binary(new Uint8Array(await req.arrayBuffer()));
	const parts = text
		.split(`--${boundary}`)
		.slice(1, -1)
		.map((part) => part.slice(part.indexOf('\r\n\r\n') + 4, -2));
	return {
		metadata: JSON.parse(new TextDecoder().decode(bytesOf(parts[0]))),
		content: bytesOf(parts[1])
	};
}

/** The `appProperties has {…}`, `mimeType` and `in parents` conditions of a query. */
function matches(file: FakeFile, q: string): boolean {
	if (file.trashed && q.includes('trashed = false')) return false;
	for (const [, key, value] of q.matchAll(/appProperties has \{ key='(.+?)' and value='(.+?)' \}/g))
		if (file.appProperties[key] !== value) return false;
	const mime = /mimeType = '(.+?)'/.exec(q)?.[1];
	return !mime || file.mimeType === mime;
}

export function fakeDrive(options: { account?: string } = {}) {
	const files = new Map<string, FakeFile>();
	let nextId = 1;
	let clock = Date.parse('2026-09-26T12:00:00.000Z');
	const state = {
		files,
		/** The access token Drive accepts; changing it makes the saved one stale. */
		validToken: 'access-1',
		/** What the proxy answers a refresh with; set to a status to refuse it. */
		refresh: { status: 200, error: '' },
		/** Answers the next Drive call with this status and error reason, once. */
		failNext: null as { status: number; reason?: string } | null,
		calls: [] as string[]
	};

	function json(body: unknown, status = 200): Response {
		return Response.json(body, { status });
	}

	function view(file: FakeFile) {
		return {
			id: file.id,
			name: file.name,
			size: String(file.content.length),
			modifiedTime: file.modifiedTime,
			appProperties: file.appProperties
		};
	}

	function tick(): string {
		clock += 1000;
		return new Date(clock).toISOString();
	}

	const fetcher: typeof fetch = async (input, init) => {
		const req = new Request(
			input instanceof Request ? input : new URL(String(input), 'https://moneta.example'),
			init
		);
		const url = new URL(req.url);
		state.calls.push(`${req.method} ${url.pathname}`);

		if (url.pathname.startsWith('/api/oauth/')) {
			const body = (await req.json()) as { grant: string };
			if (body.grant === 'refresh_token') {
				if (state.refresh.status !== 200)
					return json({ error: state.refresh.error }, state.refresh.status);
				state.validToken = `access-${Number(state.validToken.split('-')[1]) + 1}`;
				return json({ access_token: state.validToken, expires_in: 3599 });
			}
			return json({
				access_token: state.validToken,
				expires_in: 3599,
				refresh_token: 'refresh',
				scope: 'https://www.googleapis.com/auth/drive.file'
			});
		}
		if (url.hostname === 'oauth2.googleapis.com') return new Response(null, { status: 200 });

		if (req.headers.get('authorization') !== `Bearer ${state.validToken}`)
			return json({ error: { errors: [{ reason: 'authError' }] } }, 401);
		if (state.failNext) {
			const { status, reason } = state.failNext;
			state.failNext = null;
			return json({ error: { errors: reason ? [{ reason }] : [] } }, status);
		}

		const path = url.pathname.replace(/^\/(upload\/)?drive\/v3/, '');
		if (path === '/about')
			return json({ user: { emailAddress: options.account ?? 'me@example.com' } });
		if (path === '/files' && req.method === 'GET') {
			const q = url.searchParams.get('q') ?? '';
			const found = [...files.values()]
				.filter((f) => matches(f, q))
				.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
			return json({ files: found.map(view) });
		}
		if (path === '/files' && req.method === 'POST') {
			const upload = url.searchParams.get('uploadType') === 'multipart';
			const { metadata, content } = upload
				? await readMultipart(req)
				: { metadata: (await req.json()) as Partial<FakeFile>, content: new Uint8Array() };
			const file: FakeFile = {
				id: `file-${nextId++}`,
				name: metadata.name ?? 'Untitled',
				mimeType: metadata.mimeType ?? 'application/octet-stream',
				parents: metadata.parents ?? [],
				appProperties: metadata.appProperties ?? {},
				modifiedTime: tick(),
				content,
				trashed: false
			};
			files.set(file.id, file);
			return json(view(file));
		}
		const id = /^\/files\/([^/]+)$/.exec(path)?.[1];
		const file = id ? files.get(id) : undefined;
		if (!file) return json({ error: { errors: [{ reason: 'notFound' }] } }, 404);
		if (req.method === 'PATCH') {
			const { metadata, content } = await readMultipart(req);
			Object.assign(file, {
				name: metadata.name ?? file.name,
				appProperties: { ...file.appProperties, ...metadata.appProperties },
				content,
				modifiedTime: tick()
			});
			return json(view(file));
		}
		if (req.method === 'DELETE') {
			files.delete(file.id);
			return new Response(null, { status: 204 });
		}
		if (url.searchParams.get('alt') === 'media') return new Response(file.content);
		return json(view(file));
	};

	/** The backups saved, oldest first, as `day device` pairs. */
	function backups(): string[] {
		return [...files.values()]
			.filter((f) => f.appProperties.moneta === 'backup')
			.sort((a, b) => a.modifiedTime.localeCompare(b.modifiedTime))
			.map((f) => `${f.appProperties.day} ${f.appProperties.device}`);
	}

	return { state, fetcher, backups };
}
