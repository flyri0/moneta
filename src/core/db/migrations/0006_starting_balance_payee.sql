-- Starting balances have no payee: `is_opening` marks them, and their category is the one to
-- edit. Openings drop the old "Starting Balance" payee, which goes away unless something else
-- still uses it; then it stays, as an ordinary payee.
UPDATE transactions SET payee_id = NULL
WHERE is_opening = 1 AND payee_id IN (
	SELECT id FROM payees WHERE lower(trim(name)) IN ('starting balance', 'saldo inicial')
);

DELETE FROM payees
WHERE lower(trim(name)) IN ('starting balance', 'saldo inicial')
	AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.payee_id = payees.id)
	AND NOT EXISTS (SELECT 1 FROM schedules s WHERE s.payee_id = payees.id);
