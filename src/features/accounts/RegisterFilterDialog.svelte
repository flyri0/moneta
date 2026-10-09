<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { DateRangePicker } from '$ui/date-range-picker';
	import { Input } from '$ui/input';
	import AmountPreview from '$components/AmountPreview.svelte';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import FlagFilterField from '$features/flags/FlagFilterField.svelte';
	import { useFlags } from '$features/flags/use-flags.svelte';
	import type { RegisterFilters } from '$features/accounts/register-filters.svelte';
	import type { StatusFilter } from '$features/accounts/register-filters';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import type { ActionError } from '$client/notify';
	import type { FlagFilter } from '$domain/flag';
	import { formatAmountInput } from '$domain/money';
	import { MAX_DATE, MIN_DATE } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * The register's filters beyond the search: period, category, payee, amount, status and flags. The
	 * fields are a draft until Apply, so the list doesn't reload on every pick.
	 */
	let { open = $bindable(false), filters }: { open: boolean; filters: RegisterFilters } = $props();

	const session = useSession();
	const tree = useLive(session.client, ['categories', 'category_groups'], () =>
		session.api.categories.tree()
	);
	const payees = useLive(session.client, ['payees'], () => session.api.payees.options());
	const flagNames = useFlags();
	// Filtering never creates a category, but the picker's contract wants somewhere to put one.
	const pending = new NewCategories();

	let period = $state({ from: '', to: '' });
	let categoryId = $state('');
	let payeeId = $state('');
	let amountMin = $state('');
	let amountMax = $state('');
	let status = $state<StatusFilter>('');
	let flags = $state.raw<FlagFilter>([]);
	let error = $state<ActionError | null>(null);

	const STATUS: Record<StatusFilter, () => string> = {
		'': m.register_filter_status_any,
		cleared: m.register_filter_status_cleared,
		uncleared: m.register_filter_status_uncleared
	};
	const payeeItems = $derived((payees.data ?? []).map((p) => ({ value: p.id, label: p.name })));

	// Each time the dialog opens, start from what is in force.
	$effect(() => {
		if (!open) return;
		period = { from: filters.from, to: filters.to };
		categoryId = filters.categoryId;
		payeeId = filters.payeeId;
		amountMin =
			filters.amountMin === null ? '' : formatAmountInput(filters.amountMin, session.money);
		amountMax =
			filters.amountMax === null ? '' : formatAmountInput(filters.amountMax, session.money);
		status = filters.status;
		flags = filters.flags;
		error = null;
	});

	/** An empty box is no bound; a typed amount counts by its size, so its sign is dropped. */
	function bound(text: string): number | null | undefined {
		if (!text.trim()) return null;
		const minor = session.parse(text);
		return minor === null ? undefined : Math.abs(minor);
	}

	function apply() {
		const min = bound(amountMin);
		const max = bound(amountMax);
		if (min === undefined || max === undefined) {
			error = { message: m.register_filter_invalid_amount() };
			return;
		}
		if (min !== null && max !== null && min > max) {
			error = { message: m.register_filter_amount_order() };
			return;
		}
		filters.from = period.from;
		filters.to = period.to;
		filters.categoryId = categoryId;
		filters.payeeId = payeeId;
		filters.amountMin = min;
		filters.amountMax = max;
		filters.status = status;
		filters.flags = flags;
		open = false;
	}

	function reset() {
		filters.clearFilters();
		open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.register_filters_title()}>
	<form
		class="grid gap-4 py-2"
		onsubmit={(e) => {
			e.preventDefault();
			apply();
		}}
	>
		<div class="grid gap-2">
			<Label for="filter-period">{m.register_filter_period()}</Label>
			<DateRangePicker
				id="filter-period"
				ariaLabel={m.register_filter_period()}
				min={MIN_DATE}
				max={MAX_DATE}
				bind:value={period}
				clearable
			/>
		</div>
		<div class="grid gap-2">
			<Label for="filter-category">{m.register_filter_category()}</Label>
			<CategoryCombobox
				id="filter-category"
				ariaLabel={m.register_filter_category()}
				tree={tree.data ?? []}
				{pending}
				bind:value={categoryId}
				emptyLabel={m.register_filter_any_category()}
				creatable={false}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="filter-payee">{m.register_filter_payee()}</Label>
			<Combobox
				id="filter-payee"
				ariaLabel={m.register_filter_payee()}
				items={payeeItems}
				bind:value={payeeId}
				placeholder={m.register_filter_any_payee()}
				emptyOption={{ value: '', label: m.register_filter_any_payee() }}
			/>
		</div>
		<div class="grid grid-cols-2 items-start gap-3">
			<div class="grid gap-2">
				<Label for="filter-min">{m.register_filter_amount_min()}</Label>
				<Input id="filter-min" bind:value={amountMin} inputmode="decimal" autocomplete="off" />
				<AmountPreview text={amountMin} />
			</div>
			<div class="grid gap-2">
				<Label for="filter-max">{m.register_filter_amount_max()}</Label>
				<Input id="filter-max" bind:value={amountMax} inputmode="decimal" autocomplete="off" />
				<AmountPreview text={amountMax} />
			</div>
		</div>
		<div class="grid gap-2">
			<Label for="filter-status">{m.register_filter_status()}</Label>
			<Select.Root type="single" bind:value={status}>
				<Select.Trigger id="filter-status" class="w-full">{STATUS[status]()}</Select.Trigger>
				<Select.Content>
					{#each Object.keys(STATUS) as value (value)}
						<Select.Item {value} label={STATUS[value as StatusFilter]()}>
							{STATUS[value as StatusFilter]()}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="grid gap-2">
			<span class="text-sm font-medium">{m.register_filter_flags()}</span>
			<FlagFilterField
				bind:value={flags}
				flags={flagNames.data}
				ariaLabel={m.register_filter_flags()}
			/>
		</div>
		<FormMessage {error} />
		<Button type="button" variant="ghost" class="justify-self-start" onclick={reset}>
			{m.register_clear_filters()}
		</Button>
		<div class="grid grid-cols-2 gap-2">
			<Button type="button" variant="outline" onclick={() => (open = false)}>{m.cancel()}</Button>
			<Button type="submit">{m.register_filter_apply()}</Button>
		</div>
	</form>
</ResponsiveDialog>
