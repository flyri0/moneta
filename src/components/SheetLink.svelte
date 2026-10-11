<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { cn } from '$utils';

	/** A row that opens another screen of a sheet: icon, label, an optional detail and a chevron. */
	let {
		icon: Icon,
		label,
		detail,
		destructive = false,
		invalid = false,
		onclick
	}: {
		icon: typeof ChevronRightIcon;
		label: string;
		detail?: string;
		destructive?: boolean;
		invalid?: boolean;
		onclick: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
<button
	type="button"
	class={cn(
		'flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
		destructive && 'text-destructive'
	)}
	{onclick}
	aria-invalid={invalid || undefined}
>
	<Icon class="size-4 shrink-0" />
	<span class="flex-1">{label}</span>
	{#if detail}<span
			class={cn('min-w-0 truncate', invalid ? 'text-destructive' : 'text-muted-foreground')}
			>{detail}</span
		>{/if}
	<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
</button>
