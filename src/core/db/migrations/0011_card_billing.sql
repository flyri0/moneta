-- A credit card's billing cycle: the day of the month its bill closes and the day it is due (both
-- or neither; a day past a month's end falls on its last day). They date installment purchases.
ALTER TABLE accounts ADD COLUMN closing_day INTEGER
	CHECK (closing_day IS NULL OR closing_day BETWEEN 1 AND 31);
ALTER TABLE accounts ADD COLUMN due_day INTEGER
	CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31);
