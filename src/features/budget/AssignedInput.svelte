<script lang="ts">
	import { toast } from 'svelte-sonner';
	import AmountPreview from '$components/AmountPreview.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runActionToast } from '$client/notify';
	import { formatAmountInput } from '$domain/money';
	import type { Month } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import { neighbor } from './assigned-nav';

	/**
	 * Inline "Assigned" cell: shows the amount, edits as plain text, accepts arithmetic like 120+35.
	 * Enter and the down arrow move to the next category's cell, up and Shift+Enter to the previous;
	 * a value that can't be read keeps the keyboard in the cell, marked invalid; leaving it any other
	 * way brings the saved amount back.
	 */
	let {
		categoryId,
		month,
		assigned,
		label
	}: { categoryId: string; month: Month; assigned: number; label: string } = $props();

	const session = useSession();
	let editing = $state(false);
	let text = $state('');
	let invalid = $state(false);

	function focus(event: FocusEvent) {
		if (!invalid) text = assigned === 0 ? '' : formatAmountInput(assigned, session.money);
		editing = true;
		queueMicrotask(() => (event.target as HTMLInputElement).select());
	}

	/** The typed amount, or null when it can't be read. A blank cell is zero. */
	function typed(): number | null {
		return text.trim() === '' ? 0 : session.parse(text);
	}

	async function commit() {
		if (!editing) return;
		editing = false;
		const value = typed();
		if (value === null) {
			// Leaving gives up the unreadable text; the keyboard already warned if it was marked.
			if (!invalid) toast.error(m.form_error_amount_invalid());
			invalid = false;
			return;
		}
		invalid = false;
		if (value === assigned) return;
		await runActionToast(() => session.api.budget.setAssigned(categoryId, month, value));
	}

	function keydown(event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;
		if (event.key === 'Escape') {
			invalid = false;
			editing = false;
			input.blur();
			return;
		}
		const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : null;
		if (event.key !== 'Enter' && !step) return;
		event.preventDefault();
		if (typed() === null) {
			invalid = true;
			toast.error(m.form_error_amount_invalid());
			return;
		}
		invalid = false;
		if (event.key === 'Enter') move(input, event.shiftKey ? -1 : 1, true);
		else if (step) move(input, step, false);
	}

	/** Focuses the neighbouring cell, which commits this one; at either end, Enter just commits. */
	function move(input: HTMLInputElement, step: 1 | -1, blurAtEnd: boolean) {
		const cells = [...document.querySelectorAll<HTMLInputElement>('input[data-assigned-input]')];
		const next = neighbor(
			cells.filter((c) => c === input || c.offsetParent !== null),
			input,
			step
		);
		if (next) next.focus();
		else if (blurAtEnd) input.blur();
	}
</script>

<!-- The preview floats under the cell, so typing never changes the row's height. -->
<div class="relative">
	<input
		class="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:outline-none aria-invalid:border-destructive"
		inputmode="decimal"
		autocomplete="off"
		aria-label={label}
		data-testid="assigned"
		data-assigned-input
		aria-invalid={invalid}
		value={editing ? text : session.format(assigned)}
		oninput={(e) => (text = e.currentTarget.value)}
		onfocus={focus}
		onblur={commit}
		onkeydown={keydown}
	/>
	{#if editing}<AmountPreview {text} floating />{/if}
</div>
