<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { formatAmountInput } from '$domain/money';
	import type { Month } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';

	/** Inline "Assigned" cell: shows the amount, edits as plain text, accepts arithmetic like 120+35. */
	let {
		categoryId,
		month,
		assigned,
		label
	}: { categoryId: string; month: Month; assigned: number; label: string } = $props();

	const session = useSession();
	let editing = $state(false);
	let text = $state('');

	function focus(event: FocusEvent) {
		text = assigned === 0 ? '' : formatAmountInput(assigned, session.money);
		editing = true;
		queueMicrotask(() => (event.target as HTMLInputElement).select());
	}

	async function commit() {
		if (!editing) return;
		editing = false;
		const value = text.trim() === '' ? 0 : session.parse(text);
		if (value === null) {
			toast.error(m.form_error_amount_invalid());
			return;
		}
		if (value === assigned) return;
		await runActionToast(() => session.api.budget.setAssigned(categoryId, month, value));
	}

	function keydown(event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;
		if (event.key === 'Enter') input.blur();
		if (event.key === 'Escape') {
			editing = false;
			input.blur();
		}
	}
</script>

<input
	class="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:outline-none"
	inputmode="decimal"
	autocomplete="off"
	aria-label={label}
	data-testid="assigned"
	value={editing ? text : session.format(assigned)}
	oninput={(e) => (text = e.currentTarget.value)}
	onfocus={focus}
	onblur={commit}
	onkeydown={keydown}
/>
