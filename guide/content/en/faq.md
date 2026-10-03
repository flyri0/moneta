# Troubleshooting

## "Moneta is open in another tab" {#another-tab}

A budget can be open in only one place at a time. Close the other tab or window, or choose **Use
Moneta here**. If the other tab doesn't answer (a phone may have frozen it in the background),
**Open here anyway** takes over; whatever the other tab hadn't saved is lost. An installed app and a
browser tab count as two places.

## "Storage isn't available" {#storage-unavailable}

Moneta needs the browser's private storage for the site. Private or incognito windows, and some
older browsers, block it. Open Moneta in a normal window of an up-to-date browser.

## "Storage is full" {#storage-full}

The device has no space left for your budget. Free up space and reload. Your budget isn't
touched.

## My budget disappeared {#budget-gone}

The browser's data for the site was cleared: by you, by a cleanup tool, or by the browser itself to
free up space (Safari also clears sites you haven't opened for a week, unless Moneta is installed).
Restore your latest backup: **Settings → Backup → Restore from a backup**, or **Restore from Google
Drive**. To keep it from happening again, install Moneta and turn on **Data protection** in
**Settings → Storage**. See [Your data and backups](data.md#clearing-site-data).

## I forgot my backup password {#forgot-password}

Restore with the recovery key instead: on the unlock screen, choose **Use the recovery key
instead**. Then, on a device where Moneta is set up, **Change password** for the backups to come.
Without the password or the recovery key, an encrypted backup can't be opened by anyone.

## Moving to a new phone or computer {#new-device}

1. On the old device, **Back up now**, and move the `.moneta` file to the new one (or let the
   automatic backup to Google Drive run).
2. On the new device, open Moneta. The setup offers **Already have a backup?**: restore the file,
   or restore from Google Drive.
3. Enter the backup's password or recovery key if it is encrypted.

## A backup was made by a newer Moneta {#too-new}

A budget or a backup saved by a newer version needs that version to open. Reload Moneta, or use
**Check for updates** in **Settings → About**, then try again.

## Something looks wrong after an update {#after-update}

Before an update changes how a budget is stored, Moneta saves a copy of it. Restore one from
**Settings → Backup → Saved copies** as a new budget and compare.

## The guide doesn't open offline {#guide-offline}

Moneta works offline, but this guide doesn't: it isn't downloaded with the app, so installing and
updating stay light. Open it again when you are online. Your budget is not affected.

## Reporting a problem {#report}

Moneta is open source. Report bugs on [GitHub](https://github.com/flyri0/moneta/issues), with a test
budget: issues are public, so never attach a backup of your real budget or screenshots of your real
balances.
