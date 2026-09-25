/** The shortest password backup encryption accepts. */
export const MIN_PASSWORD_LENGTH = 8;
/**
 * The lowest zxcvbn score (0 to 4) accepted: 3 is "safely unguessable" against offline attacks
 * slowed down, as PBKDF2 slows them, and a backup file may end up where anyone can try.
 */
export const MIN_PASSWORD_STRENGTH = 3;

/** A password as backup encryption reads it: accents composed the same way on every device. */
export function normalizePassword(password: string): string {
	return password.normalize('NFC');
}

/**
 * What is wrong with a new backup password and its confirmation, or null when nothing is.
 * `strength` is `passwordStrength` of the password, or null while it is being worked out.
 */
export function passwordProblem(
	password: string,
	confirm: string,
	strength: number | null = null
): 'short' | 'weak' | 'mismatch' | null {
	const typed = normalizePassword(password);
	if (typed.length < MIN_PASSWORD_LENGTH) return 'short';
	if (strength !== null && strength < MIN_PASSWORD_STRENGTH) return 'weak';
	if (typed !== normalizePassword(confirm)) return 'mismatch';
	return null;
}

let checker: Promise<(password: string) => number> | null = null;

/** zxcvbn with English and Portuguese words, loaded the first time a password is rated. */
async function loadChecker(): Promise<(password: string) => number> {
	const [{ ZxcvbnFactory }, common, en, ptBr] = await Promise.all([
		import('@zxcvbn-ts/core'),
		import('@zxcvbn-ts/language-common'),
		import('@zxcvbn-ts/language-en'),
		import('@zxcvbn-ts/language-pt-br')
	]);
	const zxcvbn = new ZxcvbnFactory({
		dictionary: { ...common.dictionary, ...en.dictionary, ...ptBr.dictionary },
		graphs: common.adjacencyGraphs
	});
	return (password) => zxcvbn.check(password).score;
}

/**
 * How hard a password is to guess, from 0 (among the most common) to 4, estimated on this device.
 * The word lists load on first use, so they stay out of the app's first download.
 */
export async function passwordStrength(password: string): Promise<number> {
	checker ??= loadChecker().catch((err: unknown) => {
		checker = null;
		throw err;
	});
	return (await checker)(normalizePassword(password));
}
