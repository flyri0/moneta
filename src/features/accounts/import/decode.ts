/** How an OFX 1.x header or an XML declaration names a Windows or Latin-1 charset. */
const LATIN =
	/CHARSET:\s*(?:1252|ISO-?8859-1|8859-1)|encoding=["'](?:windows-1252|iso-8859-1)["']/i;

/**
 * A statement file's text. OFX says its charset in its header; anything else is read as UTF-8,
 * or as Windows-1252 (what Brazilian banks often export) when it isn't valid UTF-8.
 */
export function decodeStatement(bytes: Uint8Array): string {
	const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
	if (LATIN.test(head)) return new TextDecoder('windows-1252').decode(bytes);
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder('windows-1252').decode(bytes);
	}
}
