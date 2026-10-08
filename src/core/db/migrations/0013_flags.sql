-- Flags: one of six colors on a transaction or a schedule (passed on to the transactions it
-- enters), NULL for none. A color the user renamed has a row in flags; the others show their
-- default name.
ALTER TABLE transactions ADD COLUMN flag TEXT
	CHECK (flag IS NULL OR flag IN ('red', 'orange', 'yellow', 'green', 'blue', 'purple'));
ALTER TABLE schedules ADD COLUMN flag TEXT
	CHECK (flag IS NULL OR flag IN ('red', 'orange', 'yellow', 'green', 'blue', 'purple'));

CREATE TABLE flags (
	color TEXT PRIMARY KEY CHECK (color IN ('red', 'orange', 'yellow', 'green', 'blue', 'purple')),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50)
);
