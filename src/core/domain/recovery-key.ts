/**
 * A backup recovery key: 20 random bytes (160 bits), written as 32 Crockford base32 characters in
 * groups of 4, e.g. `7K2M-…-Q9XD`. The alphabet leaves out I, L, O and U, so the key is easy to
 * read back from paper.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BYTES = 20;
const CHARS = (BYTES * 8) / 5;

/** `bytes` (20 of them) as a recovery key. */
export function formatRecoveryKey(bytes: Uint8Array): string {
	if (bytes.length !== BYTES) throw new RangeError(`A recovery key is ${BYTES} bytes`);
	let text = '';
	let buffer = 0;
	let bits = 0;
	for (const byte of bytes) {
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			text += ALPHABET[(buffer >> bits) & 31];
		}
	}
	return text.match(/.{4}/g)!.join('-');
}

/**
 * The bytes of a typed recovery key, or null when it isn't one. Case, spaces and dashes don't
 * matter, and O reads as 0, I and L as 1.
 */
export function parseRecoveryKey(text: string): Uint8Array | null {
	const chars = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
	if (chars.length !== CHARS) return null;
	const bytes = new Uint8Array(BYTES);
	let buffer = 0;
	let bits = 0;
	let i = 0;
	for (const char of chars) {
		const value = ALPHABET.indexOf(char);
		if (value < 0) return null;
		buffer = ((buffer << 5) | value) & 0xfff;
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			bytes[i++] = (buffer >> bits) & 255;
		}
	}
	return bytes;
}

/** A new random recovery key. */
export function newRecoveryKey(): string {
	return formatRecoveryKey(crypto.getRandomValues(new Uint8Array(BYTES)));
}
