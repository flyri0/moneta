# How the budget works

The budget screen shows one month at a time. At the top is **Ready to Assign**; below it, your
categories in their groups, each with three numbers: **Assigned**, **Activity** and
**Available**. Use the arrows beside the month, or tap its name, to move between months.

## Give every unit of money a job {#zero-based}

Moneta budgets the money you have now, not money you expect. When income arrives in an account
that is on the budget, it adds to Ready to Assign. You then assign it to categories, which work
like envelopes: what is in Groceries is for groceries. The goal is a Ready to Assign of zero,
with every unit of money in a category.

## Ready to Assign {#ready-to-assign}

Ready to Assign is the money that has no job yet. Tap it to see how it is worked out:

![Ready to Assign opened: funds available, minus what was overspent last month, minus what was assigned this month.](img/ready-to-assign-light.png)

| Line                 | What it is                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| Funds available      | What was left last month, plus this month's income                              |
| Overspent last month | Overspending last month that wasn't covered (see [overspending](#overspending)) |
| Assigned this month  | Everything assigned to categories in this month                                 |

- **Positive:** money waiting for a job. Assign it.
- **Zero:** every unit of money has a job.
- **Negative:** you assigned more than you have. Take some back from a category, or record the
  income you're missing.

Ready to Assign is never stored: Moneta works it out from your transactions and what you assigned,
every time. Income counts in the month of its date, so a paycheck dated the 30th adds to that
month.

## Assigning money {#assigning}

Tap a category to open its sheet, and type how much it gets this month in **Assigned this
month**. Amounts accept simple math: `120+35` or `400/2`. Saved from the sheet, the change can be
undone right after.

On a wide screen, the budget is a table and you can also type straight into a category's
**Assigned** column. There, **Enter** saves and moves to the next category (**Shift+Enter** to the
one before), the **↑** and **↓** arrows move too, and **Esc** cancels what you typed. Changes
made in the column aren't offered for undo.

- **Activity** is what was spent (or received) in the category this month, from your transactions.
- **Available** is what is left: what carried over from last month, plus Assigned, plus Activity.

You can assign ahead into future months, for a bill that comes later. If assigning ahead would
leave a future month's Ready to Assign below zero, Moneta warns you with the month it happens in.

### Moving money between categories {#move-money}

Plans change. Open a category and use **Move money**: pick another category and an amount, and it
moves from one to the other in this month. Each move can be undone right after (see
[Undo](transactions.md#undo)).

![A category's sheet: what is available, what was assigned this month, and Quick assign, Move money, Goal and Roll overspending over.](img/category-light.png)

## Overspending {#overspending}

When a category spends more than it had, its Available goes negative and shows in red, and a
notice at the top says how much was overspent; **Review** opens the first overspent category. You
can cover it in two ways:

- **Cover from Ready to Assign**, when there is unassigned money.
- **Take from another category** that has money to spare.

If you leave it uncovered, the month closes with that category below zero. Next month, the
category starts again from zero, and the amount comes out of next month's Ready to Assign as
**Overspent last month**. The money was spent; the budget has to account for it somewhere.

## Carrying overspending over {#carryover}

For some categories you'd rather keep the debt in the category itself, for example a category you
fill a little every month and sometimes spend ahead of. Turn on **Roll overspending over** in the
category's sheet: a negative Available then stays in the category next month, and Ready to
Assign is left alone. You refill the category by assigning to it.

What is left in a category always carries over to the next month, whatever this setting.

## Quick assign {#quick-assign}

**Quick assign** sets what is assigned this month for a whole group (tap the group's name) or for
one category (tap the category):

- **Same as last month**: what each category got last month.
- **Average spent (3, 6 or 12 months)**: what each category spent on average.
- **Cover overspending**: just enough to bring overspent categories back to zero.
- **Fund goals**: what each category's goal asks for this month.
- **Clear**: assign nothing.

Options that wouldn't change anything are left out. Quick assign can be undone right after.

## Goals {#goals}

A category can have a goal: tap the category, then **Goal**. There are two kinds:

- **Every month**: assign this amount every month. For bills and everyday spending.
- **Save up**: build the category's balance up to an amount, for savings and bigger expenses.
  Optionally **by a month**: Moneta spreads what is left over the months until then, rounded up
  so the last month never falls short.

The category shows how much is still needed this month, or **Goal met**. A save-up goal counts from
the balance the month started with, so what it asks for doesn't shift while you assign during the
month. **Fund goals** in Quick assign assigns what the goals ask for at once; it only ever raises an
amount, and leaves categories without a goal as they are.

## Groups, order and hiding {#categories}

- **Groups** gather categories (Bills, Everyday…). Add one with **Add group**; tap a group's name to
  add a category to it, run Quick assign on it, or delete it, and open **Group settings** to rename
  or hide it. Tap the arrow to collapse it.
- **Icons**: give a group or a category an emoji in its settings (**Icon**), shown before its name.
  Search the emoji by name, browse them by group, and pick a skin tone with the hand beside the
  search; the ones you picked last come first. The **×** beside the field takes the icon away.
- **Edit order** lets you drag groups and categories, or move them with the arrows.
- **Hiding** a category or a group keeps its history and money but takes it off the budget screen.
  Both wait at the bottom, under **Hidden**: to bring one back, tap it, open **Category settings**
  (or **Group settings**) and turn off **Hidden**. Hiding a group hides all its categories.
- **Deleting** a category that was used asks where its transactions and assigned money should go.
  Deleting a group moves its categories to the group you choose.

The **Income** group is managed by Moneta: income categories send their money straight to Ready to
Assign instead of holding it themselves.
