<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { m } from '$i18n/paraglide/messages';

	/** A full report's page: the way back to the overview, its title, then the report. */
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<nav class="flex items-center gap-1 text-sm text-muted-foreground">
		<a
			href={resolve('/reports')}
			class="inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium transition-colors hover:text-foreground"
		>
			<ChevronLeftIcon class="size-4" />
			<span>{m.nav_reports()}</span>
		</a>
	</nav>
	<h1 class="text-xl font-semibold">{title}</h1>
	{@render children()}
</div>
<svelte:head><title>{title} · {m.app_name()}</title></svelte:head>
