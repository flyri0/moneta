# Scheduled transactions

Rent, salary, subscriptions: transactions that repeat can be scheduled once and then entered by
themselves, or with a tap. Find them under **Schedules** in the sidebar, or the **Scheduled** tab of Transactions on a phone.

## Creating a schedule {#creating}

**Add schedule** asks for the same fields as a transaction (account, payee, amount, category,
memo and [flag](transactions.md#flags)), plus:

- **Next date**: the first occurrence.
- **Repeats**: once, daily, weekly, monthly or yearly, and **every** how many days, weeks, months
  or years.
- **Ends**: never, on a date, or after a number of times.
- **On weekends**: what happens when a date falls on a Saturday or Sunday.
- **Enter automatically**: on or off.
- **Installments**, for a card purchase, at the top of **Repeats**: a purchase you're already
  paying, numbered as it goes (see [below](#installments-under-way)).

A monthly schedule on the 31st falls on the last day of shorter months, and goes back to the 31st
when the month has one.

## Installments already under way {#installments-under-way}

A purchase paid in installments that started before you used Moneta, or that you never entered,
can still be scheduled from the installment you're on. For a purchase entered now, use
**Installments** in the transaction instead ([Installments](accounts.md#installments)).

Choose the card in a new schedule, or tap **Already paying one? Add it as a schedule** below
Installments in a card purchase. Then:

1. Fill in the payee, the category and the memo, and in **Amount** what **each** installment costs.
2. Open **Repeats**, switch **Installments** on, and enter the **next installment** and the total, as your
   bill shows it: for "4/12", 4 of 12.

For example, a TV in 12 installments of $80.00, with three already paid: the schedule enters 4/12
to 12/12, nine of them, $720.00 in all, with the memo numbered ("TV 4/12").

They follow the same rules as a new purchase in installments:

- Only a card purchase offers them: not a transfer, an income or a split. Switch to another
  account and the option goes away.
- They repeat every month and end after the last one, so the schedule doesn't ask how it repeats.
- On a card with billing days, each one falls on its bill's due date, the next one on the next due
  date from today, and you don't pick the date. Without billing days, you pick the next one's date.
- They're entered automatically, like the installments of a new purchase. You can turn that off.

The installments you already paid aren't entered: past months of your budget stay as they are.
To fix the numbers later, edit the schedule and change them under **Repeats**.

## Search and filters {#search}

The search box finds schedules by payee, account, category, memo or amount, ignoring accents and
case. Every word must match. **Filters** narrow the list by next date, account, category, payee,
amount, status (due, upcoming, paused or ended) and type: entered automatically, entered by hand,
or installments. **Clear filters** shows them all again.

## The weekend rule {#weekend-rule}

Banks don't move money on weekends. For an occurrence on a Saturday or Sunday, you can:

- **Keep the date**;
- **Move to the Friday before**, as a salary often is;
- **Move to the Monday after**, as a bill often is.

Daily schedules always keep their dates.

## Automatic or by hand {#auto-enter}

- **Enter automatically**: Moneta enters the transaction on its date, the next time the app is
  open. If you open it after a few days away, it catches up on every date it missed, each on its
  own date.
- Otherwise the occurrence waits in the account as **due** until you **Enter** it (you can adjust
  it first, for a bill that changed) or **Skip** it.

If you save an automatic schedule whose first date is in the past, Moneta tells you how many
transactions it is about to enter right away, so a wrong year doesn't fill your register.

## What's coming {#upcoming}

![The scheduled transactions: rent and a card payment by hand, and a paycheck entered automatically.](img/schedules-light.png)

Each account lists the occurrences of the next 30 days and its **projected** balance, so you can
see whether the money will be there. The schedules screen groups them as **Due**, **Upcoming**, and
**Paused or ended**. A schedule pauses when its account is closed.

Tapping a schedule opens its overview: the amount, account, category, how it repeats (or which
installment is next and how many are left) and its next dates. From there, **Enter next** or
**Skip next** handles its next occurrence, and **Edit schedule** or **Delete schedule** is one tap
away. In an account, **View schedule** opens the same overview.

Editing a schedule changes the occurrences still to come. Deleting it keeps the transactions it
already entered.
