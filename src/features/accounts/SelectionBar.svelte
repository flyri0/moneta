<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import TagIcon from '@lucide/svelte/icons/tag';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Label } from '$ui/label';
	import ConfirmDialog from '$components/ConfirmDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { fab } from '$components/app/fab.svelte';
	import CategoryCombobox from '$features/transactions/CategoryCombobox.svelte';
	import { NewCategories } from '$features/transactions/new-categories';
	import type { RegisterSelection } from '$features/accounts/selection.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, runActionToast, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { BulkChange, BulkResult, TransactionRow } from '$db/repos/transactions';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The actions on the register's chosen rows, at the bottom of the screen: set their category or
	 * date, mark them cleared or not, delete them. Each one can be undone from its toast.
	 */
	let { selection, rows }: { selection: RegisterSelection; rows: TransactionRow[] } = $props();

	const session = useSession();
	const tree = useLive(session.client, ['categories', 'category_groups'], () =>
		session.api.categories.tree()
	);

	let editing = $state<'category' | 'date' | null>(null);
	let dialogOpen = $state(false);
	let deleting = $state(false);
	let categoryId = $state('');
	let date = $state(todayIso());
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	const pending = new NewCategories();

	const ids = $derived([...selection.ids]);
	const none = $derived(ids.length === 0);
	const reconciled = $derived(rows.some((r) => r.reconciled && selection.has(r.id)));

	// The floating add button would sit on the bar.
	$effect(() => {
		fab.hidden = true;
		return () => (fab.hidden = false);
	});

	function edit(what: 'category' | 'date') {
		editing = what;
		categoryId = '';
		date = todayIso();
		error = null;
		dialogOpen = true;
	}

	function changedMessage({ changed, skipped }: BulkResult): string {
		return skipped > 0
			? m.bulk_changed_skipped({ count: changed, skipped })
			: m.bulk_changed({ count: changed });
	}

	/** Applies a change; the rows stay chosen for the next one. */
	async function change(update: BulkChange): Promise<void> {
		const call = session.api.transactions.updateMany(ids, update);
		const result = await call;
		offerUndo(session.client, call, changedMessage(result));
	}

	async function apply(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		if (editing === 'category' && !categoryId) {
			error = { message: m.error_category_required() };
			return;
		}
		if (editing === 'date' && !date) {
			error = { message: m.bulk_date_required() };
			return;
		}
		busy = true;
		error = await runAction(async () => {
			if (editing === 'date') return change({ date });
			const created = await pending.resolve(session.api, [categoryId]);
			await change({ categoryId: created.get(categoryId) ?? categoryId });
		});
		busy = false;
		if (!error) dialogOpen = false;
	}

	function setCleared(cleared: boolean) {
		return runActionToast(() => change({ cleared }));
	}

	async function remove() {
		const call = session.api.transactions.deleteMany(ids);
		const { changed } = await call;
		offerUndo(session.client, call, m.bulk_deleted({ count: changed }));
	}
</script>

<div
	class="fixed inset-x-3 bottom-[calc(3.5rem+0.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-0.5 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur md:sticky md:inset-x-auto md:bottom-4"
	role="toolbar"
	aria-label={m.bulk_actions()}
	data-testid="selection-bar"
>
	<Button
		variant="ghost"
		size="icon-sm"
		aria-label={m.select_done()}
		onclick={() => selection.stop()}
	>
		<XIcon />
	</Button>
	<span class="min-w-0 flex-1 truncate px-1 text-sm font-medium">
		<!-- Phones have room for the number alone. -->
		<span class="tabular-nums sm:hidden" aria-hidden="true">{ids.length}</span>
		<span class="sr-only sm:not-sr-only" data-testid="selection-count">
			{m.bulk_selected({ count: ids.length })}
		</span>
	</span>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 md:px-3"
		aria-label={m.select_all()}
		onclick={() => selection.toggleAll(rows.map((r) => r.id))}
	>
		<ListChecksIcon />
		<span class="hidden lg:inline">{m.select_all()}</span>
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 md:px-3"
		aria-label={m.bulk_category()}
		disabled={none}
		onclick={() => edit('category')}
	>
		<TagIcon />
		<span class="hidden md:inline">{m.bulk_category()}</span>
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 md:px-3"
		aria-label={m.bulk_date()}
		disabled={none}
		onclick={() => edit('date')}
	>
		<CalendarIcon />
		<span class="hidden md:inline">{m.bulk_date()}</span>
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 md:px-3"
		aria-label={m.bulk_cleared()}
		disabled={none}
		onclick={() => setCleared(true)}
	>
		<CircleCheckIcon />
		<span class="hidden lg:inline">{m.bulk_cleared()}</span>
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 md:px-3"
		aria-label={m.bulk_uncleared()}
		disabled={none}
		onclick={() => setCleared(false)}
	>
		<CircleIcon />
		<span class="hidden lg:inline">{m.bulk_uncleared()}</span>
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="px-2 text-destructive hover:text-destructive md:px-3"
		aria-label={m.delete()}
		disabled={none}
		onclick={() => (deleting = true)}
	>
		<Trash2Icon />
		<span class="hidden md:inline">{m.delete()}</span>
	</Button>
</div>

<ResponsiveDialog
	bind:open={dialogOpen}
	title={editing === 'date' ? m.bulk_date() : m.bulk_category()}
	description={m.bulk_selected({ count: ids.length })}
>
	<form class="grid gap-4" onsubmit={apply}>
		{#if editing === 'category'}
			<div class="grid gap-2">
				<Label for="bulk-category">{m.transaction_category()}</Label>
				<CategoryCombobox
					id="bulk-category"
					tree={tree.data ?? []}
					{pending}
					bind:value={categoryId}
					ariaLabel={m.transaction_category()}
				/>
			</div>
		{:else}
			<div class="grid gap-2">
				<Label for="bulk-date">{m.transaction_date()}</Label>
				<DatePicker id="bulk-date" bind:value={date} />
			</div>
		{/if}
		<FormMessage {error} />
		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={() => (dialogOpen = false)}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy}>{m.bulk_apply()}</Button>
		</div>
	</form>
</ResponsiveDialog>

<ConfirmDialog
	bind:open={deleting}
	title={m.bulk_delete_title({ count: ids.length })}
	body={reconciled ? `${m.bulk_delete_body()} ${m.bulk_delete_reconciled()}` : m.bulk_delete_body()}
	confirmLabel={m.delete()}
	onConfirm={remove}
/>
