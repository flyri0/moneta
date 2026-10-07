# Accounts

Accounts hold your transactions: a checking account, a wallet, a credit card, a loan. **Accounts**
lists them with their balances, and tapping one opens its register.

## Budget and tracking accounts {#account-kinds}

When you add an account, you first pick its type. Types come in two kinds:

- **On budget**: checking, savings, cash and credit cards. Accounts you plan to spend from soon.
  Their money is budgeted in categories: income into them adds to Ready to Assign, and every
  transaction needs a category.
- **Tracking**: investments, loans and other assets or debts. They count toward your net worth
  but stay out of the budget, and their transactions have no category.

![Adding an account: on-budget types (checking, savings, cash, credit card) above, tracking types (investment, loan, other) below.](img/account-types-light.png)

Credit cards are always on budget. The type can't be changed once the account exists: its
settings rename it, give it an emoji **Icon** in place of its type's, set a card's billing days,
and close or delete it. If you chose the wrong kind, add the account again with the right one and
change the account of its transactions.

## Starting balance {#starting-balance}

A new account asks for its **current balance** (for a card or a loan, the **amount owed**) and the
date it is **as of**. Moneta records it as the account's first transaction, a starting balance.

On an on-budget account, the starting balance goes to the **Starting balance category** you pick
on the same form, normally **Starting Balance** in the Income group, so the money you already have
lands in Ready to Assign. A card's starting debt, in that same category, comes out of Ready to
Assign instead: the money to pay it has to come from somewhere. To pay an old debt off over time
instead, see [A credit card that already has debt](situations.md#existing-card-debt).

## Credit cards {#credit-cards}

Moneta treats a card purchase like any other spending: it takes the money from the purchase's
category right away, the day you buy. The card's balance shows what you owe.

Paying the bill is a **transfer** from your checking account to the card. It moves money between
two on-budget accounts, so it has no category and doesn't touch the budget: the categories were
already charged when you bought. As long as your categories don't go negative, the money for the
bill is there.

A purchase that you can't cover yet makes its category overspent, like any spending (see
[Overspending](budgeting.md#overspending)).

### Billing days {#card-billing}

In a card's settings you can set its **closing day** (when the bill closes) and **due day** (when
it must be paid), from 1 to 31. Both are optional, but set both or neither. A day past the end of a
short month falls on its last day. Moneta uses them to date installments.

### Installments {#installments}

A purchase on a credit card can be paid in installments: fill in **Installments** (2 to 99) when
you enter it. Moneta shows the plan before you save, for example "First $333.34, then 2 of
$333.33": the first installment takes the cents left over.

![A card purchase of $1,000.00 in 10 installments: the plan shows 10 payments of $100.00 and the first due date.](img/installments-light.png)

- The first installment is entered now; the rest become a schedule that enters each one by itself
  a month apart, with the memo numbered ("TV 2/12").
- On a card with billing days, every installment, the first one too, goes on the due date of its
  bill. A purchase on the closing day goes on the next bill.
- Each installment is charged to the category in the month it is entered, so the budget follows
  what you pay each month.

The remaining installments show under **Schedules**, as "Installment 2 of 12", and in the card's
upcoming list. A purchase you were already paying before goes in as a schedule from the next
installment: see [Installments already under way](schedules.md#installments-under-way).

## The register {#register}

An account's register lists its transactions, newest first. At the top you see the **cleared** balance (what the bank has already seen), the **uncleared** amount and
the total. Mark a transaction cleared with its checkbox when it shows up on your statement.

Each account also shows what is coming in the next 30 days from its schedules, and its balance
projected 30 days ahead. See [Scheduled transactions](schedules.md).

## Reconcile {#reconcile}

Reconciling checks your records against the bank. Open the account and choose **Reconcile**:

1. Moneta asks whether the bank shows your cleared balance. If it does, **Yes, reconcile**.
2. If it doesn't, enter the balance at the bank (and its date). Moneta shows the difference.
3. Look for transactions on the statement that are missing or not marked cleared, and fix them.
   Or, if you accept the difference, **Add adjustment and reconcile**, with a category for it.

![Reconciling the checking account: Moneta shows the cleared balance and asks whether the bank shows the same.](img/reconcile-light.png)

Reconciling locks what you checked: reconciled transactions stay cleared, and the account shows
the date it was last reconciled. You can still edit them, but Moneta warns you that changing an
amount, date or account changes a balance you already checked with your bank.

## Closing and deleting {#closing}

- **Close account** when you stop using one. It needs a zero balance: move what is left or pay it
  off first. A closed account keeps its history, shows under **Closed**, and can be reopened.
  Schedules on a closed account pause.
- **Delete account** is only for accounts without transactions or schedules, for example one added
  by mistake.
