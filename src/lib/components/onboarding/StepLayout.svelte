<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { m } from '$lib/paraglide/messages';

	/** The card every onboarding step is drawn in: progress, copy, the step's body, and the footer. */
	let {
		title,
		description,
		current,
		total,
		nextLabel,
		backLabel,
		onBack,
		onNext,
		busy = false,
		error = null,
		children
	}: {
		title: string;
		description?: string;
		current: number;
		total: number;
		nextLabel: string;
		backLabel?: string;
		onBack?: () => void;
		onNext: () => void;
		busy?: boolean;
		error?: string | null;
		children?: Snippet;
	} = $props();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onNext();
	}
</script>

<main class="flex min-h-dvh items-start justify-center p-4 sm:items-center">
	<Card.Root class="w-full max-w-lg">
		<Card.Header>
			<p class="text-xs font-medium text-muted-foreground">
				{m.onboarding_step_of({ current, total })}
			</p>
			<div class="mt-2 mb-3 flex gap-1" aria-hidden="true">
				{#each { length: total }, i (i)}
					<span class="h-1 flex-1 rounded-full {i < current ? 'bg-primary' : 'bg-muted'}"></span>
				{/each}
			</div>
			<Card.Title class="text-xl">{title}</Card.Title>
			{#if description}
				<Card.Description>{description}</Card.Description>
			{/if}
		</Card.Header>
		<Card.Content>
			<form class="grid gap-6" onsubmit={submit}>
				{#if children}
					{@render children()}
				{/if}
				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}
				<div class="flex flex-col gap-2 sm:flex-row-reverse">
					<Button type="submit" disabled={busy}>{nextLabel}</Button>
					{#if backLabel && onBack}
						<Button type="button" variant="outline" disabled={busy} onclick={onBack}>
							{backLabel}
						</Button>
					{/if}
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</main>
