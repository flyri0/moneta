<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$utils';
	import { pickerFilter } from '$ui/combobox/match';

	export type CommandRootApi = CommandPrimitive.Root;

	let {
		api = $bindable(null),
		ref = $bindable(null),
		value = $bindable(''),
		filter = pickerFilter,
		class: className,
		...restProps
	}: CommandPrimitive.RootProps & {
		api?: CommandRootApi | null;
	} = $props();
</script>

<CommandPrimitive.Root
	bind:this={api}
	bind:value
	bind:ref
	{filter}
	data-slot="command"
	class={cn(
		'flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground',
		className
	)}
	{...restProps}
/>
