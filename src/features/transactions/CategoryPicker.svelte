<script lang="ts">
	import { Combobox } from '$ui/combobox';
	import type { GroupNode } from '$db/repos/categories';
	import { categoryLabel, groupLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * Picks one category of `tree`, leaving hidden ones out unless already chosen. For screens
	 * outside the transaction form, which builds its own list.
	 */
	let {
		tree,
		value = $bindable(''),
		id,
		ariaLabel,
		class: className
	}: {
		tree: GroupNode[];
		value?: string;
		id?: string;
		ariaLabel?: string;
		class?: string;
	} = $props();

	const groups = $derived(
		tree
			.map((g) => ({
				heading: groupLabel(g),
				items: g.categories
					.filter((c) => !c.hidden || c.id === value)
					.map((c) => ({ value: c.id, label: categoryLabel(c) }))
			}))
			.filter((g) => g.items.length > 0)
	);
</script>

<Combobox
	{id}
	{ariaLabel}
	{groups}
	bind:value
	emptyOption={{ value: '', label: m.transaction_choose_category() }}
	placeholder={m.transaction_choose_category()}
	class={className}
/>
