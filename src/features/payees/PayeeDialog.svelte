<script lang="ts">
	import * as Alert from '$ui/alert';
	import HelpLink from '$components/HelpLink.svelte';
	import { Button } from '$ui/button';
	import { Combobox } from '$ui/combobox';
	import { Input } from '$ui/input';
	import { Label } from '$ui/label';
	import { Separator } from '$ui/separator';
	import ConfirmPanel from '$components/ConfirmPanel.svelte';
	import SheetLink from '$components/SheetLink.svelte';
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import CategoryCombobox from '$features/categories/CategoryCombobox.svelte';
	import { NewCategories } from '$features/categories/new-categories';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { inUse, mergeTargets, nameConflict } from '$features/payees/payees';
	import RuleForm from '$features/payees/RuleForm.svelte';
	import { ruleDraft, ruleSummary } from '$features/payees/rules';
	import { useSession } from '$client/app-state.svelte';
	import { useLive } from '$client/live.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { offerUndo } from '$client/undo';
	import type { GroupNode } from '$db/repos/categories';
	import type { PayeeRule } from '$db/repos/payee-rules';
	import type { Payee } from '$db/repos/payees';
	import { categoryLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Renames a payee, sets its default category and its import rules, merges it into another, or
	 * deletes it.
	 */
	let {
		open = $bindable(false),
		payee,
		payees,
		tree
	}: { open: boolean; payee: Payee; payees: Payee[]; tree: GroupNode[] } = $props();

	const session = useSession();
	let name = $state('');
	let mergeTo = $state('');
	/** The screen shown in place of the settings, if any: a confirmation or a rule's form. */
	let confirming = $state<
		| { kind: 'merge'; target: Payee }
		| { kind: 'delete' }
		| { kind: 'rule'; rule: PayeeRule | null }
		| { kind: 'delete-rule'; rule: PayeeRule }
		| null
	>(null);
	const allRules = useLive(session.client, ['payee_rules', 'payees'], () =>
		session.api.payeeRules.list()
	);
	const rules = $derived((allRules.data ?? []).filter((r) => r.payeeId === payee.id));
	const categoryNames = $derived(
		new Map(tree.flatMap((g) => g.categories.map((c) => [c.id, categoryLabel(c)])))
	);
	let busy = $state(false);
	let error = $state<ActionError | null>(null);

	$effect(() => {
		if (!open) return;
		name = payee.name;
		mergeTo = '';
		confirming = null;
		error = null;
	});

	/** The payee as the live list has it now, e.g. after its default category changed. */
	const current = $derived(payees.find((p) => p.id === payee.id) ?? payee);
	const conflict = $derived(nameConflict(payees, payee.id, name));
	const targets = $derived(
		mergeTargets(payees, payee.id).map((p) => ({ value: p.id, label: p.name }))
	);
	const pending = new NewCategories();

	/** Runs a write and shows its error inline; `close` shuts the dialog once it succeeds. */
	async function act(fn: () => Promise<unknown>, close = true) {
		busy = true;
		error = await runAction(fn);
		busy = false;
		if (!error && close) open = false;
	}

	/** Moves to a confirmation screen, or back to the settings with `null`. */
	function confirm(next: typeof confirming) {
		confirming = next;
		error = null;
	}

	function rename(event: SubmitEvent) {
		event.preventDefault();
		if (conflict) return;
		void act(() => session.api.payees.rename(payee.id, name));
	}

	/** Saves the default category, creating it first when it was picked by a new name. */
	function setDefaultCategory(id: string) {
		void act(async () => {
			const ids = await pending.resolve(session.api, [id]);
			await session.api.payees.setDefaultCategory(payee.id, (ids.get(id) ?? id) || undefined);
		}, false);
	}

	function askMerge(targetId: string) {
		const target = payees.find((p) => p.id === targetId);
		if (target) confirm({ kind: 'merge', target });
	}

	function confirmed() {
		if (!confirming) return;
		const pending = confirming;
		if (pending.kind === 'delete-rule') {
			const call = session.api.payeeRules.delete(pending.rule.id);
			void act(() => call, false).then(() => {
				if (error) return;
				confirm(null);
				offerUndo(session.client, call, m.payee_rule_deleted());
			});
			return;
		}
		if (pending.kind === 'rule') return;
		const [call, message] =
			pending.kind === 'merge'
				? [
						session.api.payees.merge(payee.id, pending.target.id),
						m.payee_merged({ from: payee.name, to: pending.target.name })
					]
				: [session.api.payees.delete(payee.id), m.payee_deleted()];
		void act(() => call).then(() => {
			if (!error) offerUndo(session.client, call, message);
		});
	}

	/** The line under a rule: its category, when it sets one. */
	function ruleCategory(rule: PayeeRule): string | null {
		return rule.categoryId ? (categoryNames.get(rule.categoryId) ?? null) : null;
	}
</script>

<ResponsiveDialog
	bind:open
	title={confirming?.kind === 'merge'
		? m.payee_merge_title({ name: confirming.target.name })
		: confirming?.kind === 'delete'
			? m.payee_delete_title()
			: confirming?.kind === 'rule'
				? confirming.rule
					? m.payee_rule_edit_title()
					: m.payee_rule_new_title()
				: confirming?.kind === 'delete-rule'
					? m.payee_rule_delete_title()
					: payee.name}
	onBack={confirming ? () => confirm(null) : undefined}
	focusFirst={false}
>
	{#if confirming?.kind === 'rule'}
		{@const rule = confirming.rule}
		<RuleForm
			initial={rule
				? {
						kind: rule.kind,
						text: rule.text,
						payeeName: payee.name,
						categoryId: rule.categoryId ?? ''
					}
				: { ...ruleDraft(payee.name, payee.name), text: '' }}
			ruleId={rule?.id ?? null}
			payee={current.name}
			{tree}
			onSaved={() => confirm(null)}
			onCancel={() => confirm(null)}
		/>
		{#if rule}
			<div class="-mx-2 mt-2 grid">
				<SheetLink
					icon={Trash2Icon}
					label={m.payee_rule_delete()}
					destructive
					onclick={() => confirm({ kind: 'delete-rule', rule })}
				/>
			</div>
		{/if}
	{:else if confirming}
		<ConfirmPanel
			body={confirming.kind === 'merge'
				? m.payee_merge_body({ from: payee.name, to: confirming.target.name })
				: confirming.kind === 'delete-rule'
					? m.payee_rule_delete_body()
					: m.payee_delete_body()}
			confirmLabel={confirming.kind === 'merge' ? m.payee_merge_button() : m.delete()}
			{error}
			{busy}
			onCancel={() => confirm(null)}
			onConfirm={confirmed}
		/>
	{:else}
		<div class="grid gap-4">
			<form class="grid gap-2" onsubmit={rename}>
				<Label for="payee-rename">{m.payee_name()}</Label>
				<div class="flex gap-2">
					<Input id="payee-rename" bind:value={name} required autocomplete="off" />
					<Button type="submit" variant="outline" disabled={conflict !== null}>{m.save()}</Button>
				</div>
			</form>
			{#if conflict}
				<Alert.Root>
					<Alert.Description class="grid gap-2">
						<p>{m.payee_exists({ name: conflict.name })}</p>
						<Button
							variant="outline"
							size="sm"
							class="h-auto min-h-8 max-w-full justify-self-start py-1.5 text-left whitespace-normal"
							onclick={() => askMerge(conflict.id)}
						>
							{m.payee_merge_into({ name: conflict.name })}
						</Button>
					</Alert.Description>
				</Alert.Root>
			{/if}

			<div class="grid gap-2">
				<Label for="payee-category">{m.payee_default_category()}</Label>
				<CategoryCombobox
					id="payee-category"
					class="w-full"
					ariaLabel={m.payee_default_category()}
					{tree}
					{pending}
					value={current.defaultCategoryId ?? ''}
					onSelect={setDefaultCategory}
					emptyLabel={m.payee_default_none()}
				/>
				<p class="text-xs text-muted-foreground">{m.payee_default_category_hint()}</p>
			</div>

			<div class="grid gap-2" data-testid="payee-rules">
				<div class="flex items-center justify-between gap-2">
					<span class="text-sm font-medium">{m.payee_rules()}</span>
					<Button variant="outline" size="sm" onclick={() => confirm({ kind: 'rule', rule: null })}>
						<PlusIcon />
						{m.payee_rule_add()}
					</Button>
				</div>
				{#if rules.length > 0}
					<ul class="divide-y overflow-hidden rounded-lg border">
						{#each rules as rule (rule.id)}
							<li>
								<button
									type="button"
									class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
									onclick={() => confirm({ kind: 'rule', rule })}
								>
									<span class="grid min-w-0 gap-0.5">
										<span class="truncate text-sm" data-testid="payee-rule"
											>{ruleSummary(rule)}</span
										>
										{#if ruleCategory(rule)}
											<span class="truncate text-xs text-muted-foreground"
												>{ruleCategory(rule)}</span
											>
										{/if}
									</span>
									<PencilIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span class="sr-only">{m.payee_rule_edit()}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<p class="text-xs text-muted-foreground">{m.payee_rules_hint()}</p>
				<HelpLink topic="payeeRules" text />
			</div>

			<Separator />

			{#if targets.length > 0}
				<div class="grid gap-2">
					<Label for="payee-merge">{m.payee_merge()}</Label>
					<div class="grid gap-2 md:flex">
						<Combobox
							id="payee-merge"
							class="md:min-w-0 md:flex-1"
							ariaLabel={m.payee_merge()}
							items={targets}
							bind:value={mergeTo}
							placeholder={m.payee_merge_choose()}
						/>
						<Button variant="outline" disabled={!mergeTo} onclick={() => askMerge(mergeTo)}>
							{m.payee_merge_button()}
						</Button>
					</div>
					<p class="text-xs text-muted-foreground">{m.payee_merge_hint()}</p>
				</div>
			{/if}

			{#if !inUse(current)}
				<div class="grid gap-1">
					<div class="-mx-2 grid">
						<SheetLink
							icon={Trash2Icon}
							label={m.payee_delete()}
							destructive
							onclick={() => confirm({ kind: 'delete' })}
						/>
					</div>
					<p class="text-xs text-muted-foreground">{m.payee_delete_hint()}</p>
				</div>
			{:else}
				<p class="text-xs text-muted-foreground">{m.payee_in_use_hint()}</p>
			{/if}
			<FormMessage {error} />
		</div>
	{/if}
</ResponsiveDialog>
