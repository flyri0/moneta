<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TagIcon from '@lucide/svelte/icons/tag';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$ui/button';
	import { DatePicker } from '$ui/date-picker';
	import { Label } from '$ui/label';
	import EditBar from '$components/EditBar.svelte';
	import ConfirmDialog from '$components/ConfirmDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import type { RegisterSelection } from '$features/accounts/selection.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, runActionToast, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { BulkChange, BulkResult, TransactionRow } from '$db/repos/transactions';
	import { todayIso } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * While `selection` is active, the actions on the register's chosen rows, at the bottom of the screen: set their category or
	 * date, mark them cleared or not, delete them. Each one ends the selection and can be undone
	 * from its toast.
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
	// Taken when a dialog opens: the selection ends before it has finished closing.
	let count = $state(0);
	let reconciled = $state(false);
	const pending = new NewCategories();

	const ids = $derived([...selection.ids]);
	const none = $derived(ids.length === 0);
	const listed = $derived(rows.map((r) => r.id));
	const allChosen = $derived(listed.length > 0 && listed.every((id) => selection.has(id)));
	/** With every chosen row cleared already, the bar offers to unclear them instead. */
	const allCleared = $derived(
		!none && rows.filter((r) => selection.has(r.id)).every((r) => r.cleared)
	);
	const actions = $derived([
		{ key: 'category', icon: TagIcon, label: m.bulk_category_short(), run: () => edit('category') },
		{ key: 'date', icon: CalendarIcon, label: m.bulk_date_short(), run: () => edit('date') },
		allCleared
			? { key: 'cleared', icon: CircleIcon, label: m.bulk_unclear(), run: () => setCleared(false) }
			: {
					key: 'cleared',
					icon: CircleCheckIcon,
					label: m.bulk_clear(),
					run: () => setCleared(true)
				},
		{
			key: 'delete',
			icon: Trash2Icon,
			label: m.delete(),
			run: confirmDelete,
			destructive: true
		}
	]);

	function edit(what: 'category' | 'date') {
		count = ids.length;
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

	/** Applies a change, then leaves selection with the changed rows marked for a moment. */
	async function change(update: BulkChange): Promise<void> {
		const chosen = ids;
		const call = session.api.transactions.updateMany(chosen, update);
		const result = await call;
		selection.finish(chosen);
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

	function confirmDelete() {
		count = ids.length;
		reconciled = rows.some((r) => r.reconciled && selection.has(r.id));
		deleting = true;
	}

	async function remove() {
		const call = session.api.transactions.deleteMany(ids);
		const { changed } = await call;
		selection.stop();
		offerUndo(session.client, call, m.bulk_deleted({ count: changed }));
	}
</script>

{#if selection.active}
	<EditBar label={m.bulk_actions()} testId="selection-bar">
		<div class="flex flex-col gap-1 p-1.5 @3xl:flex-row @3xl:items-center">
			<div class="flex min-w-0 items-center gap-1 @3xl:flex-1">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={m.select_done()}
					onclick={() => selection.stop()}
				>
					<XIcon />
				</Button>
				<span
					class="min-w-0 flex-1 truncate px-1 text-sm font-medium tabular-nums"
					data-testid="selection-count"
				>
					{m.bulk_selected({ count: ids.length })}
				</span>
				<Button variant="ghost" size="sm" onclick={() => selection.toggleAll(listed)}>
					{allChosen ? m.select_none() : m.select_all()}
				</Button>
			</div>
			<div class="flex gap-0.5 border-t pt-1 @3xl:border-t-0 @3xl:pt-0">
				{#each actions as action (action.key)}
					<Button
						variant="ghost"
						size="sm"
						class="h-auto min-w-0 flex-auto flex-col gap-1 px-1 py-1.5 text-[0.6875rem] @3xl:h-8 @3xl:flex-none @3xl:flex-row @3xl:gap-1.5 @3xl:px-3 @3xl:py-0 @3xl:text-sm {action.destructive
							? 'text-destructive hover:text-destructive'
							: ''}"
						disabled={none}
						onclick={action.run}
					>
						<action.icon />
						<span class="max-w-full truncate">{action.label}</span>
					</Button>
				{/each}
			</div>
		</div>
	</EditBar>
{/if}

<ResponsiveDialog
	bind:open={dialogOpen}
	title={editing === 'date' ? m.bulk_date() : m.bulk_category()}
	description={m.bulk_selected({ count })}
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
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" onclick={() => (dialogOpen = false)}>{m.cancel()}</Button>
			<Button type="submit" disabled={busy}>{m.bulk_apply()}</Button>
		</div>
	</form>
</ResponsiveDialog>

<ConfirmDialog
	bind:open={deleting}
	title={m.bulk_delete_title({ count })}
	body={reconciled ? `${m.bulk_delete_body()} ${m.bulk_delete_reconciled()}` : m.bulk_delete_body()}
	confirmLabel={m.delete()}
	onConfirm={remove}
/>
