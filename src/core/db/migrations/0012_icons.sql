-- An emoji icon for accounts, category groups and categories, stored as its text ('🍕'); NULL
-- when there is none.
ALTER TABLE accounts ADD COLUMN icon TEXT CHECK (icon IS NULL OR length(icon) BETWEEN 1 AND 32);
ALTER TABLE category_groups ADD COLUMN icon TEXT
	CHECK (icon IS NULL OR length(icon) BETWEEN 1 AND 32);
ALTER TABLE categories ADD COLUMN icon TEXT CHECK (icon IS NULL OR length(icon) BETWEEN 1 AND 32);
