export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Subjects often start with an acronym or product name (CSV, SQLite, PWA).
		'subject-case': [0]
	}
};
