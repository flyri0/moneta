<script lang="ts">
	import { Button } from '$ui/button';
	import type { BootState } from '$client/app-state.svelte';
	import type { StartupErrorCode } from '$client/session';
	import { m } from '$i18n/paraglide/messages';

	let {
		boot,
		onTakeOver
	}: {
		boot: Extract<BootState, { kind: 'loading' | 'blocked' | 'error' }>;
		onTakeOver: () => void;
	} = $props();

	const ERRORS: Record<StartupErrorCode, { title: () => string; body: () => string }> = {
		STORAGE_UNAVAILABLE: {
			title: m.startup_storage_unavailable_title,
			body: m.startup_storage_unavailable_body
		},
		QUOTA_EXCEEDED: { title: m.startup_quota_title, body: m.startup_quota_body },
		SCHEMA_TOO_NEW: { title: m.startup_schema_title, body: m.startup_schema_body },
		WORKER_FAILED: { title: m.startup_worker_title, body: m.startup_worker_body },
		INTERNAL: { title: m.startup_internal_title, body: m.startup_internal_body }
	};
</script>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<p class="text-2xl font-semibold">{m.app_name()}</p>
		{#if boot.kind === 'loading'}
			<p class="text-muted-foreground" role="status">{m.startup_loading()}</p>
		{:else if boot.kind === 'blocked'}
			<h1 class="text-lg font-medium">{m.startup_blocked_title()}</h1>
			<p class="text-muted-foreground">{m.startup_blocked_body()}</p>
			<Button onclick={onTakeOver}>{m.startup_blocked_take_over()}</Button>
		{:else}
			<h1 class="text-lg font-medium">{ERRORS[boot.code].title()}</h1>
			<p class="text-muted-foreground">{ERRORS[boot.code].body()}</p>
			<pre
				class="max-w-full overflow-x-auto rounded-md bg-muted p-2 text-left text-xs">{boot.message}</pre>
			<Button onclick={() => location.reload()}>{m.startup_reload()}</Button>
		{/if}
	</div>
</main>
