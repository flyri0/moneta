<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	/**
	 * A report on the overview: a glance at it, opening the full report. The title is the link and
	 * stretches over the whole card, so everything is clickable while screen readers still read the
	 * figures as text rather than as one long link name.
	 */
	let {
		title,
		route,
		testId,
		children
	}: {
		title: string;
		/** The full report this card opens. */
		route: '/reports/spending' | '/reports/net-worth';
		testId?: string;
		children: Snippet;
	} = $props();
</script>

<section
	class="group relative grid content-start gap-4 rounded-xl border bg-card p-4 text-card-foreground transition-colors has-[a:hover]:bg-accent/40"
	data-testid={testId}
>
	<h2 class="flex items-center justify-between gap-3">
		<a
			href={resolve(route)}
			class="rounded-sm text-xs font-medium tracking-wide text-muted-foreground uppercase outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
		>
			{title}
		</a>
		<ChevronRightIcon
			class="size-4 text-muted-foreground transition-transform group-has-[a:hover]:translate-x-0.5"
			aria-hidden="true"
		/>
	</h2>
	{@render children()}
</section>
