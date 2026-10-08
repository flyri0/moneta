# Getting started

Moneta is a zero-based envelope budget, in the spirit of YNAB and Actual Budget. You give every
unit of money a job before you spend it: income lands in **Ready to Assign**, you move it into
categories, and spending draws those categories down. When one runs dry, you decide where the
money comes from, instead of finding out at the end of the month.

![The budget screen: Ready to Assign at the top, then category groups with what was assigned, spent and is still available in each one.](img/budget-light.png)

## Your data stays on this device {#your-data}

Moneta runs entirely in your browser. There is no account to create, no server and no tracking.
Each budget is a database file kept in the browser's private storage for the site, and it never
leaves your device on its own.

That is the whole point, but it has one consequence: **nobody keeps a copy for you.** Clearing
the site's data, or losing the device, loses the budget. Back up from **Settings → Backup** every
couple of weeks (Moneta reminds you when the last backup is more than two weeks old), or turn on
automatic backups to your Google Drive. See [Your data and backups](data.md).

## Try the demo {#demo}

On the welcome page, **Try the demo** opens a year of sample data: accounts, a credit card,
schedules and reports already filled in. Nothing you do there is saved. When you are ready,
**Create my budget** in the banner starts your own.

## Install it as an app {#install}

Moneta works in a browser tab, but installed it is better protected and works offline.

- **Chrome, Edge and Android:** use **Install Moneta** on the welcome page, or **Install** in the
  browser's menu.
- **iPhone and iPad:** tap the Share button, then **Add to Home Screen**.
- **Safari on a Mac:** open the File menu, then **Add to Dock**.
- **Firefox:** open the browser menu, then **Install**.

**Use it in the browser**, on the welcome page, skips installing: it shows the warning below
first, then opens Moneta.

> In a browser tab, the browser may clear the site's data to free up space, and Safari may clear
> it when you don't open Moneta for a week. If you stay in the browser, back up regularly.

Updates download by themselves. When a new version is ready, Moneta offers to reload; you can also
look for one in **Settings → About → Updates**.

## Create your first budget {#first-budget}

The first time you open Moneta, a few steps set up your budget:

1. **Welcome**: how Moneta works.
2. **One thing to know**: backups are up to you. Here, **Already have a backup?** restores a
   `.moneta` file (or an older `.sqlite` one) to bring your budgets back and skip the rest.
3. **Your budget**: its name, the currency, and the number and date format.
4. **Your categories**: pick from a starter list organized in groups (Bills, Everyday, Goals,
   Fun), add your own, or start with none. The Income group is always created.
5. **Your first account**: usually your checking account and its current balance. You can skip
   this and add accounts later.
6. **You're all set**: the budget opens, with a short tour of the basics: Ready to Assign, your
   categories, adding a transaction, the months and your accounts. It then shows where schedules,
   reports and backups are, and opens each of those screens. **Skip** ends it, and it doesn't come
   back by itself; **Settings → About → Take the tour** shows it again.

A budget you add later from **Settings → Budget files → New budget** asks only for steps 3 to 5.

Then:

1. Look at **Ready to Assign**: the money in your accounts that has no job yet.
2. Assign it to your categories until Ready to Assign reaches zero.
3. Record what you spend and receive as it happens, or import your bank statements.
4. Mark what you want to follow with a [flag](transactions.md#flags), like the dinners your job
   pays back or the costs of a trip, and find it again with the filters and the reports.

[How the budget works](budgeting.md) explains each number on the budget screen. New to envelope
budgeting? The [glossary](glossary.md) explains the words, and [Everyday situations](situations.md)
shows how to record refunds, annual bills, card debt and more.

## One tab at a time {#one-tab}

A budget can be open in only one tab or window at a time. If Moneta is already open somewhere
else, the new tab says so and offers **Use Moneta here**, which asks the other tab to step aside.
If the other tab is frozen in the background, close it, or use **Open here anyway**: whatever the
other tab hadn't saved yet is lost.

## Where things are {#navigation}

On a phone, the bar at the bottom holds Budget, Transactions, Accounts, Reports and Settings, and
the floating button adds a transaction. Payees and scheduled transactions are inside
Transactions: a **Payees** button, and the **Scheduled** tab. On a wider screen the sidebar on the
left lists them all, Payees and Schedules included, with your accounts and their balances below.
Drag its edge to make it wider or narrower, or collapse it to icons.

![Moneta on a phone: the budget, a new transaction, and the reports.](img/phone.png)
