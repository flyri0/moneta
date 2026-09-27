-- A purchase split into installments is a schedule that numbers what it enters ("2/12").
-- installment_start is the number of its first occurrence; NULL when it isn't one.
ALTER TABLE schedules ADD COLUMN installment_start INTEGER
	CHECK (installment_start IS NULL OR installment_start >= 1);
