<script lang="ts">
	import Flag from '@lucide/svelte/icons/flag';
	import type { FlagColor } from '$domain/flag';
	import { cn } from '$utils';
	import { FLAG_CLASSES } from './flags';

	/**
	 * A flag in its color, or an outline for none. With `label` it is an image with that name;
	 * without, it only decorates text that says it.
	 */
	let {
		color,
		label,
		class: className
	}: { color: FlagColor | null; label?: string; class?: string } = $props();
</script>

<Flag
	class={cn('size-4 shrink-0', color ? FLAG_CLASSES[color] : 'text-muted-foreground', className)}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-flag={color ?? 'none'}
/>
