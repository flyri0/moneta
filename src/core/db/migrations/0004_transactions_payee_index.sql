-- Finds a payee's transactions (its last category, whether it is used) without a full scan.
CREATE INDEX transactions_payee_date ON transactions (payee_id, date);
