/** The shortest password backup encryption accepts. */
export const MIN_PASSWORD_LENGTH = 8;

/** A password as backup encryption reads it: accents composed the same way on every device. */
export function normalizePassword(password: string): string {
	return password.normalize('NFC');
}

/** What is wrong with a new backup password and its confirmation, or null when nothing is. */
export function passwordProblem(password: string, confirm: string): 'short' | 'mismatch' | null {
	const typed = normalizePassword(password);
	if (typed.length < MIN_PASSWORD_LENGTH) return 'short';
	if (typed !== normalizePassword(confirm)) return 'mismatch';
	return null;
}
