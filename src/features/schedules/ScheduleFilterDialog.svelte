<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { DateRangePicker } from '$ui/date-range-picker';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import FormMessage from '$components/FormMessage.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import { useSession } from '$client/app-state.svelte';
	import type { ActionError } from '$client/notify';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { formatAmountInput } from '$domain/money';
	import { MAX_DATE, MIN_DATE } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import type { ScheduleKindFilter, ScheduleStatusFilter } from './filters';
	import type { ScheduleFilters } from './filters.svelte';

	/**
	 * The schedules' filters beyond the search: next date, account, category, payee, amount, status
	 * and type. The fields are a draft until Apply. Accounts, categories and payees are the ones
	 * `schedules` use.
	 */
	let {
		open = $bindable(false),
		filters,
		schedules
	}: { open: boolean; filters: ScheduleFilters; schedules: ScheduleRow[] } = $props();

	const session = useSession();

	let period = $state({ from: '', to: '' });
	let accountId = $state('');
	let categoryId = $state('');
	let payeeId = $state('');
	let amountMin = $state('');
	let amountMax = $state('');
	let status = $state<ScheduleStatusFilter>('');
	let kind = $state<ScheduleKindFilter>('');
	let error = $state<ActionError | null>(null);

	const STATUS: Record<ScheduleStatusFilter, () => string> = {
		'': m.register_filter_status_any,
		due: m.schedules_due,
		upcoming: m.schedules_upcoming,
		inactive: m.schedules_inactive
	};
	const KIND: Record<ScheduleKindFilter, () => string> = {
		'': m.schedules_filter_kind_any,
		auto: m.schedules_filter_kind_auto,
		manual: m.schedules_filter_kind_manual,
		installments: m.schedules_filter_kind_installments
	};

	/** Each id once, with its name, by name. */
	function items(pairs: [string | null, string | null][]) {
		const byId: Record<string, string> = {};
		for (const [id, name] of pairs) if (id && name) byId[id] = name;
		return Object.entries(byId)
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label));
	}
	const accountItems = $derived(
		items(
			schedules.flatMap((s) => [
				[s.accountId, s.accountName],
				[s.transferAccountId, s.transferAccountName]
			])
		)
	);
	const categoryItems = $derived(
		items(
			schedules.flatMap((s) => [
				[s.categoryId, s.categoryName] as [string | null, string | null],
				...s.splits.map((l): [string, string] => [l.categoryId, l.categoryName])
			])
		)
	);
	const payeeItems = $derived(items(schedules.map((s) => [s.payeeId, s.payeeName])));

	// Each time the dialog opens, start from what is in force.
	$effect(() => {
		if (!open) return;
		period = { from: filters.from, to: filters.to };
		accountId = filters.accountId;
		categoryId = filters.categoryId;
		payeeId = filters.payeeId;
		amountMin =
			filters.amountMin === null ? '' : formatAmountInput(filters.amountMin, session.money);
		amountMax =
			filters.amountMax === null ? '' : formatAmountInput(filters.amountMax, session.money);
		status = filters.status;
		kind = filters.kind;
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
		Object.assign(filters, {
			from: period.from,
			to: period.to,
			accountId,
			categoryId,
			payeeId,
			amountMin: min,
			amountMax: max,
			status,
			kind
		});
		open = false;
	}

	function reset() {
		filters.clearFilters();
		open = false;
	}
</script>

<ResponsiveDialog bind:open title={m.schedules_filters_title()}>
	<form
		class="grid gap-4 py-2"
		onsubmit={(e) => {
			e.preventDefault();
			apply();
		}}
	>
		<div class="grid gap-2">
			<Label for="schedule-filter-next">{m.schedules_filter_next()}</Label>
			<DateRangePicker
				id="schedule-filter-next"
				ariaLabel={m.schedules_filter_next()}
				min={MIN_DATE}
				max={MAX_DATE}
				bind:value={period}
				clearable
			/>
		</div>
		<div class="grid gap-2">
			<Label for="schedule-filter-account">{m.schedules_filter_account()}</Label>
			<Combobox
				id="schedule-filter-account"
				ariaLabel={m.schedules_filter_account()}
				items={accountItems}
				bind:value={accountId}
				placeholder={m.schedules_filter_any_account()}
				emptyOption={{ value: '', label: m.schedules_filter_any_account() }}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="schedule-filter-category">{m.register_filter_category()}</Label>
			<Combobox
				id="schedule-filter-category"
				ariaLabel={m.register_filter_category()}
				items={categoryItems}
				bind:value={categoryId}
				placeholder={m.register_filter_any_category()}
				emptyOption={{ value: '', label: m.register_filter_any_category() }}
			/>
		</div>
		<div class="grid gap-2">
			<Label for="schedule-filter-payee">{m.register_filter_payee()}</Label>
			<Combobox
				id="schedule-filter-payee"
				ariaLabel={m.register_filter_payee()}
				items={payeeItems}
				bind:value={payeeId}
				placeholder={m.register_filter_any_payee()}
				emptyOption={{ value: '', label: m.register_filter_any_payee() }}
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="grid gap-2">
				<Label for="schedule-filter-min">{m.register_filter_amount_min()}</Label>
				<Input
					id="schedule-filter-min"
					bind:value={amountMin}
					inputmode="decimal"
					autocomplete="off"
				/>
			</div>
			<div class="grid gap-2">
				<Label for="schedule-filter-max">{m.register_filter_amount_max()}</Label>
				<Input
					id="schedule-filter-max"
					bind:value={amountMax}
					inputmode="decimal"
					autocomplete="off"
				/>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="grid gap-2">
				<Label for="schedule-filter-status">{m.register_filter_status()}</Label>
				<Select.Root type="single" bind:value={status}>
					<Select.Trigger id="schedule-filter-status" class="w-full">
						{STATUS[status]()}
					</Select.Trigger>
					<Select.Content>
						{#each Object.keys(STATUS) as value (value)}
							<Select.Item {value} label={STATUS[value as ScheduleStatusFilter]()}>
								{STATUS[value as ScheduleStatusFilter]()}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid gap-2">
				<Label for="schedule-filter-kind">{m.schedules_filter_kind()}</Label>
				<Select.Root type="single" bind:value={kind}>
					<Select.Trigger id="schedule-filter-kind" class="w-full">{KIND[kind]()}</Select.Trigger>
					<Select.Content>
						{#each Object.keys(KIND) as value (value)}
							<Select.Item {value} label={KIND[value as ScheduleKindFilter]()}>
								{KIND[value as ScheduleKindFilter]()}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
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
