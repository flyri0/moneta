CREATE TABLE meta (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE accounts (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	type TEXT NOT NULL CHECK (
		type IN ('checking', 'savings', 'cash', 'credit_card', 'investment', 'loan', 'other')
	),
	on_budget INTEGER NOT NULL CHECK (on_budget IN (0, 1)),
	closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	CHECK (type <> 'credit_card' OR on_budget = 1)
);

CREATE TABLE category_groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
	system TEXT UNIQUE CHECK (system IN ('income', 'credit_card_payments'))
);

CREATE TABLE categories (
	id TEXT PRIMARY KEY,
	group_id TEXT NOT NULL REFERENCES category_groups (id),
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
	carryover_overspending INTEGER NOT NULL DEFAULT 0 CHECK (carryover_overspending IN (0, 1)),
	cc_account_id TEXT UNIQUE REFERENCES accounts (id),
	system TEXT UNIQUE CHECK (system IN ('ready_to_assign'))
);

CREATE TABLE payees (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE transactions (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL REFERENCES accounts (id),
	date TEXT NOT NULL,
	amount INTEGER NOT NULL,
	payee_id TEXT REFERENCES payees (id),
	category_id TEXT REFERENCES categories (id),
	memo TEXT NOT NULL DEFAULT '',
	cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0, 1)),
	transfer_id TEXT REFERENCES transactions (id) DEFERRABLE INITIALLY DEFERRED,
	is_split INTEGER NOT NULL DEFAULT 0 CHECK (is_split IN (0, 1)),
	CHECK (is_split = 0 OR category_id IS NULL)
);

CREATE TABLE transaction_splits (
	id TEXT PRIMARY KEY,
	transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
	category_id TEXT NOT NULL REFERENCES categories (id),
	amount INTEGER NOT NULL,
	memo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE budget_assignments (
	category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
	month TEXT NOT NULL,
	assigned INTEGER NOT NULL,
	PRIMARY KEY (category_id, month)
) WITHOUT ROWID;

CREATE INDEX transactions_account_date ON transactions (account_id, date);
CREATE INDEX transactions_category_date ON transactions (category_id, date);
CREATE INDEX transactions_date ON transactions (date);
CREATE INDEX transactions_transfer ON transactions (transfer_id);
CREATE INDEX transaction_splits_category ON transaction_splits (category_id);
CREATE INDEX transaction_splits_transaction ON transaction_splits (transaction_id);
