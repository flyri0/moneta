-- Payee rules: a statement line whose description starts with, contains or is `text` (ignoring
-- case and accents) is imported with the rule's payee, and its category when it has one.
CREATE TABLE payee_rules (
	id TEXT PRIMARY KEY,
	payee_id TEXT NOT NULL REFERENCES payees (id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('starts', 'contains', 'is')),
	text TEXT NOT NULL CHECK (length(trim(text)) > 0),
	category_id TEXT REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX payee_rules_payee ON payee_rules (payee_id);
CREATE INDEX payee_rules_category ON payee_rules (category_id);
