<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import { copyDetails, type ActionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';
	import { cn } from '$utils';

	/**
	 * The one way to show an error inline: a form's failed write (just above its buttons) or a
	 * section that failed to load. Unexpected errors offer to copy their details for a bug report.
	 */
	let { error, class: className }: { error: ActionError | null | undefined; class?: string } =
		$props();
</script>

{#if error}
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
