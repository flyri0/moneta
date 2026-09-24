<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { cn } from '$utils';

	/** A row that opens another screen of a sheet: icon, label and a chevron. */
	let {
		icon: Icon,
		label,
		destructive = false,
		onclick
	}: {
		icon: typeof ChevronRightIcon;
		label: string;
		destructive?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button
	type="button"
	class={cn(
		'flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
		destructive && 'text-destructive'
	)}
	{onclick}
>
	<Icon class="size-4 shrink-0" />
	<span class="flex-1">{label}</span>
	<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
</button>
