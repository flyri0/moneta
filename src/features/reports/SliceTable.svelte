<script lang="ts" generics="T extends Slice & { share: number }">
	import type { Snippet } from 'svelte';
	import { useSession } from '$client/app-state.svelte';
	import { numberFormat } from '$domain/intl-cache';
	import { segmentClass, type Slice } from '$features/reports/spending';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	/**
	 * A report's slices as a table: a bar per row against the biggest one, its amount and share,
	 * folded after a few rows. A row that `canOpen` toggles `selected`, for a drill-down beside it.
	 */
	let {
		rows,
		total,
		heading,
		testId,
		top = 5,
		selected = $bindable(null),
		expanded = $bindable(false),
		canOpen,
		name
	}: {
		rows: T[];
		total: number;
		heading: string;
		testId: string;
		/** Rows that wear the stacked bar's colours, as its segments do. */
		top?: number;
		selected?: string | null;
		expanded?: boolean;
		canOpen: (row: T) => boolean;
		/** What a row shows above its bar. */
		name: Snippet<[T]>;
	} = $props();

	const session = useSession();
	/** Rows shown before the list folds. Enough to see the shape of a month's spending. */
	const ROWS = 8;

	/** Bars are scaled to the biggest row, so the top one fills its track and the rest compare
	 * against it. The share column carries the percent of the total. */
	const max = $derived(Math.max(1, ...rows.map((r) => r.amount)));
	const shown = $derived(expanded ? rows : rows.slice(0, ROWS));
	const percent = $derived(
		numberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 })
	);
</script>

{#snippet bar(row: T, i: number)}
	<span class="block h-1.5 overflow-hidden rounded-full bg-muted">
		<span
			class="block h-full rounded-full {segmentClass(i < top ? i + 1 : null)}"
			style="width: {(row.amount / max) * 100}%"
		></span>
	</span>
{/snippet}

<table class="w-full text-sm" data-testid={testId}>
	<thead class="text-left text-xs text-muted-foreground">
		<tr>
			<th scope="col" class="py-1 font-medium">{heading}</th>
			<th scope="col" class="py-1 text-right font-medium">{m.reports_spent()}</th>
			<th scope="col" class="py-1 text-right font-medium">{m.reports_share()}</th>
		</tr>
	</thead>
	<tbody>
		{#each shown as row, i (row.key)}
			<tr class="border-t">
				<th scope="row" class="py-2 pr-3 text-left font-normal">
					{#if canOpen(row)}
						<button
							type="button"
							class="group grid w-full gap-1.5 text-left"
							aria-pressed={selected === row.key}
							onclick={() => (selected = selected === row.key ? null : row.key)}
						>
							{@render name(row)}
							{@render bar(row, i)}
						</button>
					{:else}
						<span class="grid gap-1.5">
							{@render name(row)}
							{@render bar(row, i)}
						</span>
					{/if}
				</th>
				<td class="py-2 text-right align-top whitespace-nowrap tabular-nums">
					{session.format(row.amount)}
				</td>
				<td
					class="py-2 pl-2 text-right align-top whitespace-nowrap text-muted-foreground tabular-nums"
				>
					{percent.format(row.share / 100)}
				</td>
			</tr>
		{/each}
		{#if rows.length > ROWS}
			<tr class="border-t">
				<td colspan="3" class="py-2">
					<button
						type="button"
						class="text-sm text-muted-foreground hover:underline"
						aria-expanded={expanded}
						onclick={() => (expanded = !expanded)}
					>
						{expanded ? m.reports_show_less() : m.reports_show_all({ count: rows.length })}
					</button>
				</td>
			</tr>
		{/if}
	</tbody>
	<tfoot>
		<tr class="border-t font-medium">
			<td class="py-2">{m.reports_total()}</td>
			<td class="py-2 text-right tabular-nums">{session.format(total)}</td>
			<td></td>
		</tr>
	</tfoot>
</table>
