# Importing bank statements

Instead of typing every transaction, you can import the statement your bank exports. Open the
account and choose **Import**, then pick the file.

## Supported files {#formats}

- **OFX** (also QFX): the bank's own format, read as is.
- **CSV**: a table. Moneta asks which column holds what.

Export one account at a time: a file with the statements of several accounts is refused. Import
it into the account it came from.

## CSV columns {#csv-columns}

For a CSV file, tell Moneta:

- whether **the first row names the columns**;
- which column is the **date**, the **description** and, optionally, a **memo**;
- whether **amounts** are in one column (negative for outflows) or in separate **inflow** and
  **outflow** columns;
- the **date format** and **number format** the bank uses;
- **Invert signs**, for card statements that list purchases as positive amounts.

The preview shows how the lines read. Moneta remembers these choices for the next import into the
same account. Lines with no date or amount are left out, and Moneta says how many.

![The columns of a CSV statement: date, description and amount, the date and number formats, and a preview of how the lines read.](img/csv-light.png)

## Reviewing the lines {#matching}

Before anything is written, every line is marked:

- **New**: it becomes a new transaction, cleared.
- **Matches**: you already entered this transaction by hand, with the same amount, dated up to four
  days apart. Importing marks yours as cleared and keeps everything else about it; nothing is
  doubled.
- **Already imported**: this line came in before, or the file repeats it. Importing the same
  statement twice, or two statements that overlap, adds nothing.

![The review of an imported statement: a line that matches a transaction entered by hand, two new lines waiting for a category, and a repeated line already imported.](img/import-light.png)

For new lines you can change the payee and the category. Moneta fills in the category from the
payee's default category or the one it usually gets. Lines still without one are listed, and you
can give them all one category at once.

**Import** writes it all at once, and it can be undone right after.

> Lines dated more than two years from now usually mean the date format is wrong. Moneta warns you
> about them before you import.

## Making a rule {#rules}

Bank descriptions are messy: `PAG*CORNERMKT 0423 SAO PAULO`. On a line, **Make a rule** sets the
payee (and optionally a category) for every description like it, in this import and the next
ones. Lines caught by a rule show a **Rule** badge. See [Payee rules](payees.md#payee-rules).
