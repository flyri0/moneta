-- A starting balance is a fact of the transaction, not a guess from its payee's name: reports
-- leave it out of income and spending. Existing budgets mark, in each account, the first
-- transaction (UUIDv7 ids sort by creation) whose payee is a starting balance one.
ALTER TABLE transactions ADD COLUMN is_opening INTEGER NOT NULL DEFAULT 0 CHECK (is_opening IN (0, 1));

UPDATE transactions SET is_opening = 1
WHERE id IN (
	SELECT MIN(t.id)
	FROM transactions t
	JOIN payees p ON p.id = t.payee_id
	WHERE lower(trim(p.name)) IN ('starting balance', 'saldo inicial')
	GROUP BY t.account_id
);
