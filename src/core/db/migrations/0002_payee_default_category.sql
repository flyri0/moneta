-- The category a payee's new transactions start with, chosen on the Payees screen.
ALTER TABLE payees ADD COLUMN default_category_id TEXT REFERENCES categories (id) ON DELETE SET NULL;
