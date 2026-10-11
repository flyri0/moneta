<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import { copyDetails, type ActionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * The one way to show an error inline: a form's failed write (just above its buttons) or a
	 * section that failed to load. Inside a form it hides once edited, until the next error. Unexpected
	 * errors offer to copy their details for a bug report.
	 */
	let {
		error,
		values,
		class: className
	}: {
		error: ActionError | null | undefined;
		/** The editable values, including custom pickers and fields outside a form. */
		values?: readonly unknown[];
		class?: string;
	} = $props();
	let anchor = $state<HTMLElement>();
	let stale = $state(false);

	let previousError: ActionError | null | undefined;
	let previousValues: string | undefined;
	$effect(() => {
		const next = error ? JSON.stringify(values) : undefined;
		if (error !== previousError) stale = false;
		else if (next !== previousValues) stale = true;
		previousError = error;
		previousValues = next;
	});

	$effect(() => {
		const form = anchor?.closest('form');
		if (!form) return;
		const edited = () => (stale = true);
		const submitted = () => (stale = false);
		form.addEventListener('input', edited);
		form.addEventListener('change', edited);
		form.addEventListener('submit', submitted);
		return () => {
			form.removeEventListener('input', edited);
			form.removeEventListener('change', edited);
			form.removeEventListener('submit', submitted);
		};
	});
</script>

<span bind:this={anchor} class="contents" aria-hidden="true"></span>
{#if error && !stale}
	<div
		class={cn('flex items-start gap-2 text-sm text-destructive', className)}
		role="alert"
		data-testid="form-message"
	>
		<CircleAlertIcon class="mt-0.5 size-4 shrink-0" />
		<p class="min-w-0">
			{error.message}
			{#if error.cause !== undefined}
				<button
					type="button"
					class="ml-1 cursor-pointer font-medium underline underline-offset-2 hover:no-underline"
					onclick={() => void copyDetails(error.cause)}
				>
					{m.copy_details()}
				</button>
			{/if}
		</p>
	</div>
{/if}
