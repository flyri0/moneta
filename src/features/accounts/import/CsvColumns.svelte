<script lang="ts">
	import { Button } from '$ui/button';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import { Switch } from '$ui/switch';
	import { useSession } from '$client/app-state.svelte';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { applyFormat, type CsvFormat, type DateOrder } from './csv';

	/** Maps a CSV's columns, with a preview of the first lines as they will import. */
	let {
		table,
		format = $bindable(),
		digits,
		onContinue,
		onCancel
	}: {
		table: string[][];
		format: CsvFormat;
		digits: number;
		onContinue: () => void;
		onCancel: () => void;
	} = $props();

	const session = useSession();
	const NONE = 'none';
	const columns = $derived(Math.max(...table.map((r) => r.length)));
	const result = $derived(applyFormat(table, format, digits));
	const split = $derived(format.amount === null);

	function columnName(i: number): string {
		const name = format.header ? table[0]?.[i]?.trim() : '';
		return name || m.import_column({ number: i + 1 });
	}

	const ORDERS: { value: DateOrder; label: string }[] = [
		{ value: 'DMY', label: 'DD/MM/YYYY' },
		{ value: 'MDY', label: 'MM/DD/YYYY' },
		{ value: 'YMD', label: 'YYYY-MM-DD' }
	];

	function setSplit(next: boolean) {
		if (next === split) return;
		format = next
			? { ...format, amount: null, inflow: format.amount, outflow: null }
			: { ...format, amount: format.inflow ?? format.outflow ?? 0, inflow: null, outflow: null };
	}
</script>

{#snippet columnSelect(
	id: string,
	label: string,
	value: number | null,
	set: (i: number | null) => void,
	optional: boolean
)}
	<div class="grid gap-2">
		<Label for={id}>{label}</Label>
		<Select.Root
			type="single"
			value={value === null ? NONE : String(value)}
			onValueChange={(v) => set(v === NONE ? null : Number(v))}
		>
			<Select.Trigger {id} class="w-full">
				{value === null ? m.import_column_none() : columnName(value)}
			</Select.Trigger>
			<Select.Content>
				{#if optional}
					<Select.Item value={NONE} label={m.import_column_none()}>
						{m.import_column_none()}
					</Select.Item>
				{/if}
				{#each { length: columns }, i (i)}
					<Select.Item value={String(i)} label={columnName(i)}>{columnName(i)}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

<div class="grid gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
	<div class="grid gap-1">
		<h2 class="font-semibold">{m.import_columns_title()}</h2>
		<p class="text-sm text-muted-foreground">{m.import_columns_hint()}</p>
	</div>

	<div class="flex items-center justify-between gap-3">
		<Label for="csv-header">{m.import_header_row()}</Label>
		<Switch
			id="csv-header"
			bind:checked={() => format.header, (v) => (format = { ...format, header: v })}
		/>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{@render columnSelect(
			'csv-date',
			m.import_date_column(),
			format.date,
			(i) => (format = { ...format, date: i ?? 0 }),
			false
		)}
		{@render columnSelect(
			'csv-description',
			m.import_description_column(),
			format.description,
			(i) => (format = { ...format, description: i ?? 0 }),
			false
		)}
		<div class="grid gap-2">
			<Label for="csv-amounts">{m.import_amounts()}</Label>
			<Select.Root
				type="single"
				value={split ? 'split' : 'one'}
				onValueChange={(v) => setSplit(v === 'split')}
			>
				<Select.Trigger id="csv-amounts" class="w-full">
					{split ? m.import_amounts_split() : m.import_amounts_one()}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="one" label={m.import_amounts_one()}
						>{m.import_amounts_one()}</Select.Item
					>
					<Select.Item value="split" label={m.import_amounts_split()}>
						{m.import_amounts_split()}
					</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
		{#if split}
			{@render columnSelect(
				'csv-inflow',
				m.import_inflow_column(),
				format.inflow,
				(i) => (format = { ...format, inflow: i }),
				true
			)}
			{@render columnSelect(
				'csv-outflow',
				m.import_outflow_column(),
				format.outflow,
				(i) => (format = { ...format, outflow: i }),
				true
			)}
		{:else}
			{@render columnSelect(
				'csv-amount',
				m.import_amount_column(),
				format.amount,
				(i) => (format = { ...format, amount: i ?? 0 }),
				false
			)}
		{/if}
		{@render columnSelect(
			'csv-memo',
			m.import_memo_column(),
			format.memo,
			(i) => (format = { ...format, memo: i }),
			true
		)}
		<div class="grid gap-2">
			<Label for="csv-date-order">{m.import_date_format()}</Label>
			<Select.Root
				type="single"
				value={format.dateOrder}
				onValueChange={(v) => (format = { ...format, dateOrder: v as DateOrder })}
			>
				<Select.Trigger id="csv-date-order" class="w-full">
					{ORDERS.find((o) => o.value === format.dateOrder)?.label}
				</Select.Trigger>
				<Select.Content>
					{#each ORDERS as order (order.value)}
						<Select.Item value={order.value} label={order.label}>{order.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="grid gap-2">
			<Label for="csv-decimal">{m.import_number_format()}</Label>
			<Select.Root
				type="single"
				value={format.decimal}
				onValueChange={(v) => (format = { ...format, decimal: v === ',' ? ',' : '.' })}
			>
				<Select.Trigger id="csv-decimal" class="w-full">
					{format.decimal === ',' ? '1.234,56' : '1,234.56'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="," label="1.234,56">1.234,56</Select.Item>
					<Select.Item value="." label="1,234.56">1,234.56</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div class="grid gap-1">
			<Label for="csv-invert">{m.import_invert()}</Label>
			<p class="text-xs text-muted-foreground">{m.import_invert_hint()}</p>
		</div>
		<Switch
			id="csv-invert"
			bind:checked={() => format.invert, (v) => (format = { ...format, invert: v })}
		/>
	</div>

	<div class="grid gap-2">
		<h3 class="text-sm font-medium">{m.import_preview()}</h3>
		<ul class="divide-y rounded-lg border text-sm" data-testid="csv-preview">
			{#each result.lines.slice(0, 5) as line (line.importId)}
				<li class="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2">
					<span class="text-muted-foreground tabular-nums"
						>{formatDate(line.date, getLocale())}</span
					>
					<span class="min-w-0 truncate">{line.description}</span>
					<span class="font-medium tabular-nums">{session.format(line.amount)}</span>
				</li>
			{:else}
				<li class="px-3 py-4 text-center text-muted-foreground">{m.import_preview_empty()}</li>
			{/each}
		</ul>
		{#if result.unreadable > 0}
			<p class="text-xs text-muted-foreground" data-testid="csv-unreadable">
				{m.import_unreadable({ count: result.unreadable })}
			</p>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" onclick={onCancel}>{m.cancel()}</Button>
		<Button
			class="h-auto min-h-9 py-1.5 whitespace-normal"
			disabled={result.lines.length === 0}
			onclick={onContinue}
		>
			{m.import_review({ count: result.lines.length })}
		</Button>
	</div>
</div>
