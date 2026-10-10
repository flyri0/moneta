# Transactions

Every movement of money is a transaction: a purchase, a paycheck, a transfer between accounts.
**Transactions** lists them across all accounts; each account's register shows its own.

## Entering a transaction {#entering}

Use the **Transaction** button (the round **+** on a phone). Fill in:

- **Account**: where the money moved.
- **Date**.
- **Payee**: who you paid or who paid you. Type a new name to create one. A payee with a default
  category fills it in; otherwise Moneta suggests the category used last time.
- **Amount**, with **Outflow** or **Inflow**. Amounts accept simple math, like `10+5`.
- **Category**: required on budget accounts. The list shows how much each category has available
  in the transaction's month. Type a name that doesn't exist to create the category (and even its
  group) as you save.
- **Memo** and **Cleared**, both optional.
- **Flag**, also optional: a color to [mark it with](#flags).

Income goes in an income category, such as Salary: that is what adds it to Ready to Assign.

A date more than two years from now is usually a typo, so Moneta asks before saving it.

### Editing or deleting one {#editing}

Tap a transaction to see all of it: amount, date, account, payee, category (or each line of a
split), memo, and whether it cleared. From there:

- **Edit transaction** opens the form: change what you need and save, or cancel to go back.
- **Open ‹account›** goes to its account. In that account already, a transfer opens the other
  account instead.
- **Delete transaction** asks first; right after, you can still [undo](#undo) it.

## Splits {#splits}

One receipt, several categories: choose **Split** and add a line per category, each with its
amount and memo. The lines must add up to the transaction's amount; Moneta shows what is left to
place.

![A purchase of $80.00 split into Groceries and Household, with nothing left to place.](img/split-light.png)

## Transfers {#transfers}

To move money between your accounts, pick the other account as the payee (under **Transfers**).
Moneta records both sides at once.

- Between two on-budget accounts (checking to savings, or paying a credit card), a transfer has no
  category and doesn't change the budget.
- From an on-budget account to a tracking one (into an investment, or a loan payment), the money
  leaves the budget, so the transfer needs a category, like spending.

## Flags {#flags}

A flag is a color you mark a transaction with, to find it again: a dinner the company will pay you
back, the costs of a trip, a bill to keep for your tax return. There are six: red, orange, yellow,
green, blue and purple. A transaction has one flag or none; it changes nothing in the budget.

- Pick one in the form's **Flag** field, or, on a transaction you open, in its **Flag** row, which
  changes it right away.
- Give a color a name: in any flag picker, **Edit flag names**. Red can become "Reimbursable" and
  blue "Trip". The name shows wherever the flag does, in this budget only; leave it empty to go
  back to the color's name.
- A transfer has a flag on each side, set apart: flagging one side leaves the other as it is.
- A [scheduled transaction](schedules.md#creating) can have a flag too, and every transaction it
  enters gets it.

The flag shows before the payee in the lists. To work with flagged transactions, **Filters** keeps
only some flags (or the ones with no flag), **Select** flags several at once, and the
[reports](reports.md#flags) can count only the flags you pick.

## Search and filters {#search}

Search matches names, categories, memos and amounts. **Filters** narrow the list by period,
category, payee, amount range, cleared status and [flag](#flags).

## Several at once {#bulk}

**Select** (or a long press on a phone) lets you pick several transactions, then:

- **Set category** or **Set date** for all of them;
- **Flag** them, or take their flag off;
- **Clear** or **Unclear** them;
- delete them.

Transactions that can't take the change are left as they were, and Moneta tells you how many: a
split, a tracking account's transaction or a transfer between budget accounts can't get a category, a reconciled transaction stays
cleared, and a closed account's transactions don't change.

## Undo {#undo}

Right after some changes, a message offers **Undo**:

- deleting one or several transactions;
- changing several transactions at once;
- assigning from a category's sheet, moving money, and quick assign;
- importing a statement;
- skipping or deleting a scheduled transaction;
- deleting a category or a group;
- deleting, merging or removing unused payees, and deleting an import rule;
- deleting an account.

Only the latest change can be taken back, and only while nothing it touched has changed again.
