/**
 * Whether what was typed confirms deleting the budget called `name`: the same name, ignoring the
 * spaces around it but not the case. A budget with no name asks for nothing; the wait still does.
 */
export function nameConfirms(typed: string, name: string): boolean {
	const expected = name.trim().normalize('NFC');
	return expected === '' || typed.trim().normalize('NFC') === expected;
}
