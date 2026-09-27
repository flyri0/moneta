<script lang="ts">
	import ResponsiveDialog from '$components/ResponsiveDialog.svelte';
	import type { GroupNode } from '$db/repos/categories';
	import { m } from '$i18n/paraglide/messages';
	import RuleForm from './RuleForm.svelte';
	import type { RuleDraft, SavedRule } from './rules';

	/** Makes a payee rule from a statement line, in a dialog of its own. */
	let {
		open = $bindable(false),
		initial,
		sample,
		tree,
		payeeNames,
		onSaved
	}: {
		open: boolean;
		initial: RuleDraft;
		sample: string;
		tree: GroupNode[];
		payeeNames: string[];
		onSaved: (rule: SavedRule) => void;
	} = $props();
</script>

<ResponsiveDialog bind:open title={m.payee_rule_new_title()}>
	{#if open}
		<RuleForm
			{initial}
			{sample}
			{tree}
			{payeeNames}
			onSaved={(rule) => {
				open = false;
				onSaved(rule);
			}}
			onCancel={() => (open = false)}
		/>
	{/if}
</ResponsiveDialog>
