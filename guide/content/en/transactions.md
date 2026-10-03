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
- **Category**: required on budget accounts. Type a name that doesn't exist to create the category
  (and even its group) as you save.
- **Memo** and **Cleared**, both optional.

Income goes in an income category, such as Salary: that is what adds it to Ready to Assign.

A date more than two years away is usually a typo, so Moneta asks before saving it.

## Splits {#splits}

One receipt, several categories: choose **Split** and add a line per category, each with its
amount and memo. The lines must add up to the transaction's amount; Moneta shows what is left to
place.

## Transfers {#transfers}

To move money between your accounts, pick the other account as the payee (under **Transfers**).
Moneta records both sides at once.

- Between two on-budget accounts (checking to savings, or paying a credit card), a transfer has no
  category and doesn't change the budget.
- From an on-budget account to a tracking one (into an investment, or a loan payment), the money
  leaves the budget, so the transfer needs a category, like spending.

## Search and filters {#search}

Search matches names, categories, memos and amounts. **Filters** narrow the list by period,
category, payee, amount range and cleared status.

## Several at once {#bulk}

**Select** (or a long press on a phone) lets you pick several transactions, then:

- **Set category** or **Set date** for all of them;
- **Clear** or **Unclear** them;
- delete them.

Transactions that can't take the change are left as they were, and Moneta tells you how many: a
split, a tracking account's transaction or a transfer between budget accounts can't get a category, a reconciled transaction stays
cleared, and a closed account's transactions don't change.

## Undo {#undo}

Right after some changes, a message offers **Undo**:

- deleting one or several transactions;
- changing several transactions at once;
- assigning, moving money, and quick assign;
- importing a statement;
- skipping a scheduled transaction.

Only the latest change can be taken back, and only while nothing it touched has changed again.
