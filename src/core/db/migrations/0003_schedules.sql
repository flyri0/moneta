-- Repeating transactions. A schedule stores a transaction template and the rule that dates it;
-- its occurrences are derived. next_index counts the occurrences entered or skipped.
CREATE TABLE schedules (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
	amount INTEGER NOT NULL,
	payee_id TEXT REFERENCES payees (id),
	category_id TEXT REFERENCES categories (id),
	transfer_account_id TEXT REFERENCES accounts (id) ON DELETE CASCADE,
	memo TEXT NOT NULL DEFAULT '',
	is_split INTEGER NOT NULL DEFAULT 0 CHECK (is_split IN (0, 1)),
	start_date TEXT NOT NULL,
	frequency TEXT NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'yearly')),
	interval INTEGER NOT NULL DEFAULT 1 CHECK (interval >= 1),
	end_date TEXT,
	end_count INTEGER CHECK (end_count IS NULL OR end_count >= 1),
	weekend TEXT NOT NULL DEFAULT 'keep' CHECK (weekend IN ('keep', 'before', 'after')),
	auto_enter INTEGER NOT NULL DEFAULT 0 CHECK (auto_enter IN (0, 1)),
	next_index INTEGER NOT NULL DEFAULT 0 CHECK (next_index >= 0),
	created_at TEXT NOT NULL,
	CHECK (is_split = 0 OR category_id IS NULL)
);

CREATE TABLE schedule_splits (
	id TEXT PRIMARY KEY,
	schedule_id TEXT NOT NULL REFERENCES schedules (id) ON DELETE CASCADE,
	category_id TEXT NOT NULL REFERENCES categories (id),
	amount INTEGER NOT NULL,
	memo TEXT NOT NULL DEFAULT ''
);

CREATE INDEX schedules_account ON schedules (account_id);
CREATE INDEX schedule_splits_schedule ON schedule_splits (schedule_id);
