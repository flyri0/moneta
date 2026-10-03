# Payees and rules

Payees are who you pay and who pays you. They are created as you type them in transactions, or
with **New payee**. **Payees** (in the sidebar, or a button on Transactions on a phone) lists them
with how many transactions each has, and **Search payees** finds one by name.

## Editing a payee {#editing}

Tap a payee to:

- **rename** it, everywhere it appears;
- give it a **default category**: new transactions with this payee start with it. Without one,
  Moneta suggests the category used last time;
- **merge** it into another payee: its transactions move there and it is deleted. Handy when the
  same store was typed two ways. Renaming a payee to a name that already exists offers the same.
- **delete** it, when no transaction, schedule or rule uses it.

**Remove unused** deletes, at once, every payee that no transaction, schedule or rule uses. A payee comes back if you type
it again.

## Import rules {#payee-rules}

A rule turns a bank's description into a payee when you import a statement. Each rule has:

- **When the description**: **Starts with**, **Contains** or **Is exactly** some text. Case,
  accents and extra spaces are ignored.
- **Use payee**: the payee the line gets.
- **Category**: one of your categories, or **the payee's usual category**.

Made from an import line, the form tells you whether the rule catches that line's description.

When several rules catch the same description, the most specific one wins: **Is exactly**, then
**Starts with**, then **Contains**; among rules of the same kind, the one with the longer text.

Add rules from a payee's **Import rules**, or from a line while importing with **Make a rule**.
Rules only act on imports; they never change transactions you already have.
