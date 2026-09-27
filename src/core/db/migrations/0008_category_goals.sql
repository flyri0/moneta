-- A category's goal: assign an amount every month ('monthly'), or build its balance up to one
-- ('target'), by goal_month when it has one. All three are NULL when the category has no goal.
ALTER TABLE categories ADD COLUMN goal_type TEXT CHECK (goal_type IN ('monthly', 'target'));
ALTER TABLE categories ADD COLUMN goal_amount INTEGER CHECK (goal_amount > 0);
ALTER TABLE categories ADD COLUMN goal_month TEXT;
