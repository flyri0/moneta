# Your data and backups

## Where your budget lives {#storage}

Each budget is one SQLite database file in your browser's private storage for the site (the
Origin Private File System). Nothing leaves your device unless you turn on automatic backups, and
then only encrypted.

### Clearing site data deletes your budget {#clearing-site-data}

Because the budget lives in the browser's storage, **clearing the site's data deletes it**: from
the browser's settings, a "clear browsing data" that includes site data, or uninstalling the
browser. So does losing the device. Keep a backup somewhere else.

In **Settings → Storage**, **Data protection** asks the browser not to clear your budget when the
device runs low on space. Some browsers decide by themselves, and usually protect installed apps.
The same section shows how much space Moneta uses.

## Several budgets {#budget-files}

You can keep several budgets side by side: your own and a family one, or a test one. **Settings →
Budget files** lists them; **New budget** starts another, and **Open** switches. Each budget has its
own accounts, categories, currency and number format (**Budget details**).

Deleting a budget asks you to type its name, then waits a few seconds before it goes: it deletes
the budget and its saved copies for good.

## Backups {#backups}

**Settings → Backup → Back up now** saves every budget on the device into one `.moneta` file in
your downloads. Keep it off the device: in your cloud storage, on a computer, on a USB stick.
Moneta reminds you when your last backup is more than two weeks old.

**Restore from a backup** reads a `.moneta` file (or an older `.sqlite` one) and lets you pick which
budgets to restore:

- a budget that isn't on the device is added;
- a budget that is already there is **replaced** by the backup. What it held is kept under **Saved
  copies**, so a mistaken restore can be undone.

## Saved copies {#saved-copies}

Moneta also saves a copy of a budget by itself:

- before an update changes how the budget is stored (the last three are kept);
- when a restore replaces it.

In **Settings → Backup → Saved copies** you can restore a copy as a new budget, or download it.

## Encrypted backups {#encryption}

Turn on **Encrypt backups** to protect the files themselves. Anyone holding an unencrypted backup
can read every transaction in it.

1. Choose a password. Moneta checks how easy it is to guess; a few unrelated words make one that is
   hard to guess and easy to remember.
2. Save the **recovery key** it shows you (see below).

From then on, backing up still asks for nothing: Moneta keeps the key on this device. **Restoring**
an encrypted backup asks for the password or the recovery key.

- **Check password** makes sure you still remember it.
- **Change password** applies to backups made from then on; older ones keep their old password and
  recovery key.
- Turning encryption off leaves the backups made before still encrypted.

Backups are encrypted with AES-256-GCM, with a key derived from your password (PBKDF2-SHA256) or
from the recovery key.

### The recovery key {#recovery-key}

The recovery key opens your encrypted backups if you forget the password. Copy it into a password
manager, or save it as a file and print it, and keep it **apart from your backups**.

> If you lose both the password and the recovery key, nobody can open those backups, Moneta
> included. There is no reset.

## Automatic backups to Google Drive {#google-drive}

Connect your Google Drive once (**Settings → Backup → Automatic backup**), and Moneta saves an
encrypted backup of every budget into a Moneta folder there by itself.

- It needs backup encryption turned on first: cloud backups are always encrypted.
- It backs up two minutes after you stop making changes, when you switch away from the app with a
  change waiting, and at start when the last backup is a day old. It only runs while Moneta is
  open.
- Each device keeps one file per day: its newest and the five days before it. Older ones are
  deleted.
- Moneta can only see the files it created in your Drive.

**Restore from Google Drive** lists the backups there, newest first, with the device that made each
one. On a new device, connect, pick one, and enter the password or recovery key.

**Disconnect** stops the automatic backups; the files already saved stay in your Drive.

> This option exists only where the site that serves Moneta has set up Google sign-in. A copy you
> host yourself may not show it.

## Exports {#exports}

**Transactions (CSV)** and **Whole budget (JSON)** export your data for spreadsheets and other
apps. They can't be restored into Moneta, and they are never encrypted: keep them somewhere safe.

## Delete everything {#wipe}

**Delete all data on this device**, in **Settings → Storage**, deletes every budget, every saved
copy and the backup key, and forgets your settings. Only your backup files can bring them back.
