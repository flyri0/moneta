<script lang="ts">
	import { useSession } from '$client/app-state.svelte';
	import { storedCategoryLabel } from '$i18n/labels';

	/** A split's lines, each with its category, memo and amount. */
	let { lines }: { lines: { id: string; categoryName: string; memo: string; amount: number }[] } =
		$props();

	const session = useSession();
</script>

<ul class="grid gap-1.5 rounded-lg bg-muted/40 p-2.5 text-xs">
	{#each lines as line (line.id)}
		<li class="flex items-center justify-between gap-2">
			<span class="truncate">
				<span class="font-medium">{storedCategoryLabel(line.categoryName)}</span>
				{#if line.memo}<span class="text-muted-foreground"> · {line.memo}</span>{/if}
			</span>
			<span class="shrink-0 font-medium tabular-nums">{session.format(line.amount)}</span>
		</li>
	{/each}
</ul>
