<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Badge } from '$ui/badge';
	import { Button } from '$ui/button';
	import { Checkbox } from '$ui/checkbox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import type { NewCategories } from '$features/categories/new-categories';
	import Amount from '$components/Amount.svelte';
	import type { GroupNode } from '$db/repos/categories';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { linkPossible, needsCategory, rowStatus, type ReviewRow } from './review';

	/**
	 * One statement line on the import review. Collapsed, it shows the payee, the bank's description
	 * and the category to pick; opened, the full description, the payee to edit and what a match
	 * would do.
	 */
	let {
		row = $bindable(),
		index,
		onBudget,
		tree,
		pending,
		expanded,
		onToggle,
		onMakeRule
	}: {
		row: ReviewRow;
		index: number;
		onBudget: boolean;
		tree: GroupNode[];
		pending: NewCategories;
		expanded: boolean;
		onToggle: () => void;
		onMakeRule: () => void;
	} = $props();

	const status = $derived(rowStatus(row));
	/** A line that may be a transaction entered by hand, waiting to be linked or not. */
	const possible = $derived(row.preview.status === 'possible' ? row.preview.match : null);
	const number = $derived(index + 1);
	/** What the line is called: the payee a new line gets, or the bank's description. */
	const title = $derived(
		status === 'new' ? row.payeeName.trim() || row.line.description : row.line.description
	);
	const showDescription = $derived(title.trim() !== row.line.description.trim());
	/** A payee changed from the description, which a rule could remember. */
	const renamed = $derived(
		status === 'new' &&
			!row.ruleId &&
			row.payeeName.trim() !== '' &&
			row.payeeName.trim() !== row.line.description.trim()
	);
</script>

<div
	class="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2 px-4 py-3 {row.include
		? ''
		: 'opacity-60'}"
	data-testid="import-row"
>
	<Checkbox
		class="mt-1"
		checked={row.include}
		disabled={status === 'duplicate'}
		aria-label={m.import_include({ description: row.line.description })}
		onCheckedChange={(v) => (row.include = v === true)}
	/>
	<button
		type="button"
		class="grid min-w-0 gap-0.5 text-left"
		aria-expanded={expanded}
		aria-label={m.import_details({ number })}
		onclick={onToggle}
	>
		<span class="truncate text-sm font-medium" data-testid="import-payee">{title}</span>
		{#if showDescription}
			<span class="truncate text-xs text-muted-foreground" data-testid="import-description">
				{row.line.description}
			</span>
		{/if}
		<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
			<span class="tabular-nums">{formatDate(row.line.date, getLocale())}</span>
			{#if possible && !row.linked}
				<Badge
					variant="outline"
					class="h-auto max-w-full shrink whitespace-normal"
					data-testid="import-possible"
				>
					{m.import_status_possible({
						payee: possible.payeeName ?? m.register_no_payee(),
						date: formatDate(possible.date, getLocale())
					})}
				</Badge>
			{:else if status === 'new'}
				<Badge variant="secondary">{m.import_status_new()}</Badge>
				{#if row.ruleId}
					<Badge variant="outline" data-testid="import-rule">{m.import_rule_badge()}</Badge>
				{/if}
			{:else if status === 'match' && row.preview.match}
				<!-- The matched payee is what tells a right match from a wrong one, so it wraps. -->
				<Badge
					variant="outline"
					class="h-auto max-w-full shrink whitespace-normal"
					data-testid="import-match"
				>
					{m.import_status_match({
						payee: row.preview.match.payeeName ?? m.register_no_payee(),
						date: formatDate(row.preview.match.date, getLocale())
					})}
				</Badge>
			{:else}
				<Badge variant="outline">{m.import_status_duplicate()}</Badge>
			{/if}
			<ChevronDownIcon class="size-3.5 transition-transform {expanded ? 'rotate-180' : ''}" />
		</span>
	</button>
	<Amount amount={row.line.amount} flow class="text-sm font-semibold" />
	{#if possible}
		<div class="col-start-2 col-end-4 flex items-center gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				aria-label={row.linked
					? m.import_possible_unlink_label({ number })
					: m.import_possible_link_label({
							number,
							payee: possible.payeeName ?? m.register_no_payee(),
							date: formatDate(possible.date, getLocale())
						})}
				onclick={() => linkPossible(row, !row.linked)}
			>
				{row.linked ? m.import_possible_unlink() : m.import_possible_link()}
			</Button>
		</div>
	{/if}

	{#if expanded}
		<div class="col-start-2 col-end-4 grid gap-3 rounded-lg bg-muted/40 p-3 text-sm">
			<div class="grid gap-0.5">
				<span class="text-xs font-medium text-muted-foreground">{m.import_description()}</span>
				<p class="break-words select-text" data-testid="import-full-description">
					{row.line.description}
				</p>
				{#if row.line.memo}
					<p class="break-words text-muted-foreground select-text">{row.line.memo}</p>
				{/if}
			</div>
			{#if status === 'new'}
				{#if possible}
					<p class="text-muted-foreground">
						{m.import_possible_details({
							payee: possible.payeeName ?? m.register_no_payee(),
							date: formatDate(possible.date, getLocale())
						})}
					</p>
				{/if}
				<div class="grid gap-1.5">
					<Label for="import-payee-{number}" class="text-xs text-muted-foreground">
						{m.transaction_payee()}
					</Label>
					<Input
						id="import-payee-{number}"
						bind:value={row.payeeName}
						aria-label={m.import_payee({ number })}
						disabled={!row.include}
						class="h-8 bg-background"
					/>
					{#if renamed && row.include}
						<button
							type="button"
							class="justify-self-start text-xs font-medium text-primary underline-offset-2 hover:underline"
							onclick={onMakeRule}
						>
							{m.import_make_rule()}
						</button>
					{/if}
				</div>
			{:else if status === 'match' && row.preview.match}
				{@const match = row.preview.match}
				<p class="text-muted-foreground">
					{m.import_match_details({
						payee: match.payeeName ?? m.register_no_payee(),
						date: formatDate(match.date, getLocale())
					})}{match.memo ? ` · ${match.memo}` : ''}
				</p>
			{/if}
		</div>
	{/if}

	{#if status === 'new' && onBudget && row.include}
		<div class="col-start-2 col-end-4">
			<CategoryCombobox
				{tree}
				{pending}
				bind:value={row.categoryId}
				ariaLabel={m.import_category({ number })}
				class="w-full {needsCategory(row, onBudget) ? 'border-destructive/50' : ''}"
			/>
		</div>
	{/if}
</div>
