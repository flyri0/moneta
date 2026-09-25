<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$ui/button';
	import FormMessage from '$components/FormMessage.svelte';
	import { actionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * What a screen shows instead of itself when it throws while rendering (a `<svelte:boundary>`'s
	 * `failed` snippet): the error, and the ways out the app has, Settings and a reload.
	 */
	let { error, reset }: { error: unknown; reset: () => void } = $props();

	// Leaving the screen that failed renders the next one afresh.
	const failedAt = page.url.href;
	$effect(() => {
		if (page.url.href !== failedAt) reset();
	});
</script>

<div class="mx-auto grid max-w-md gap-4 p-6 pt-12" data-testid="crash-screen">
	<div class="grid gap-1">
		<h1 class="text-lg font-semibold">{m.crash_title()}</h1>
		<p class="text-sm text-muted-foreground">{m.crash_body()}</p>
	</div>
	<FormMessage error={actionError(error)} />
	<div class="flex flex-wrap gap-2">
		<Button onclick={() => void goto(resolve('/settings'))}>{m.crash_settings()}</Button>
		<Button variant="outline" onclick={() => location.reload()}>{m.startup_reload()}</Button>
	</div>
</div>
