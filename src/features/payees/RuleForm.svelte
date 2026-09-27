<script lang="ts">
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import * as Select from '$ui/select';
	import FormMessage from '$components/FormMessage.svelte';
	import CategoryCombobox from '$features/transactions/CategoryCombobox.svelte';
	import { NewCategories } from '$features/transactions/new-categories';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import type { GroupNode } from '$db/repos/categories';
	import { matchRule, RULE_KINDS, type RuleKind } from '$domain/payee-rules';
	import { m } from '$i18n/paraglide/messages';
	import { kindLabel, type RuleDraft, type SavedRule } from './rules';

	/**
	 * Creates or edits a payee rule: which descriptions it catches, the payee they come in with
	 * (fixed when `payee` is given) and an optional category. `sample` is a description to show
	 * whether the rule catches it.
	 */
	let {
		initial,
		ruleId = null,
		payee = null,
		payeeNames = [],
		tree,
		sample = null,
		onSaved,
		onCancel
	}: {
		initial: RuleDraft;
		ruleId?: string | null;
		payee?: string | null;
		payeeNames?: string[];
		tree: GroupNode[];
		sample?: string | null;
		onSaved: (rule: SavedRule) => void;
		onCancel: () => void;
	} = $props();

	const session = useSession();
	// The dialog creates this form for each rule it opens.
	// svelte-ignore state_referenced_locally
	let draft = $state({ ...initial, payeeName: payee ?? initial.payeeName });
	let error = $state<ActionError | null>(null);
	let busy = $state(false);
	const pending = new NewCategories();

	const payeeItems = $derived(payeeNames.map((name) => ({ value: name, label: name })));
	const catches = $derived(
		sample !== null && draft.text.trim() !== ''
			? matchRule([{ id: '', kind: draft.kind, text: draft.text }], sample) !== null
			: null
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		let saved: SavedRule | null = null;
		error = await runAction(async () => {
			const ids = await pending.resolve(session.api, [draft.categoryId]);
			const input = {
				payeeName: draft.payeeName,
				kind: draft.kind,
				text: draft.text,
				categoryId: ids.get(draft.categoryId) ?? (draft.categoryId || null)
			};
			let id = ruleId;
			if (id) await session.api.payeeRules.update(id, input);
			else id = await session.api.payeeRules.create(input);
			saved = { id, ...input, payeeName: input.payeeName.trim(), text: input.text.trim() };
		});
		busy = false;
		if (!error && saved) onSaved(saved);
	}
</script>

<form class="grid gap-4" onsubmit={save}>
	<div class="grid gap-2">
		<Label for="rule-kind">{m.payee_rule_when()}</Label>
		<div class="grid grid-cols-[auto_1fr] gap-2">
			<Select.Root
				type="single"
				value={draft.kind}
				onValueChange={(v) => {
					if (v) draft.kind = v as RuleKind;
				}}
			>
				<Select.Trigger id="rule-kind" class="w-36">{kindLabel(draft.kind)}</Select.Trigger>
				<Select.Content>
					{#each RULE_KINDS as kind (kind)}
						<Select.Item value={kind} label={kindLabel(kind)}>{kindLabel(kind)}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Input bind:value={draft.text} aria-label={m.payee_rule_text()} required autocomplete="off" />
		</div>
		{#if catches !== null && sample}
			<p class="text-xs text-muted-foreground" data-testid="rule-sample">
				{catches
					? m.payee_rule_catches({ description: sample })
					: m.payee_rule_misses({ description: sample })}
			</p>
		{/if}
	</div>

	{#if payee === null}
		<div class="grid gap-2">
			<Label for="rule-payee">{m.payee_rule_payee()}</Label>
			<Combobox
				id="rule-payee"
				ariaLabel={m.payee_rule_payee()}
				items={payeeItems}
				bind:value={draft.payeeName}
				allowCustom
				placeholder={m.transaction_payee()}
			/>
		</div>
	{/if}

	<div class="grid gap-2">
		<Label for="rule-category">{m.payee_rule_category()}</Label>
		<CategoryCombobox
			id="rule-category"
			{tree}
			{pending}
			bind:value={draft.categoryId}
			ariaLabel={m.payee_rule_category()}
			emptyLabel={m.payee_rule_category_usual()}
		/>
	</div>

	<FormMessage {error} />
	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" disabled={busy} onclick={onCancel}>{m.cancel()}</Button>
		<Button type="submit" disabled={busy || !draft.text.trim() || !draft.payeeName.trim()}>
			{m.save()}
		</Button>
	</div>
</form>
