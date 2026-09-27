-- Bank statement imports and reconciliation. import_id is the id of the statement line a
-- transaction came from or was matched with ('ofx:<FITID>', 'csv:…'); one per account, so a
-- statement imported twice adds nothing. reconciled marks cleared transactions checked against
-- the bank's balance on reconciled_on; csv_format is the CSV column mapping last used (JSON).
ALTER TABLE transactions ADD COLUMN import_id TEXT;
ALTER TABLE transactions ADD COLUMN reconciled INTEGER NOT NULL DEFAULT 0
	CHECK (reconciled IN (0, 1));
ALTER TABLE accounts ADD COLUMN reconciled_on TEXT;
ALTER TABLE accounts ADD COLUMN csv_format TEXT;

CREATE UNIQUE INDEX transactions_import ON transactions (account_id, import_id)
	WHERE import_id IS NOT NULL;
