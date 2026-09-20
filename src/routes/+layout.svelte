<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { DEFAULT_ACCENT } from '$lib/client/accent';
	import '$lib/client/install.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import Boot from '$lib/components/app/Boot.svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();

	/** The welcome page is not the app: it opens no database and claims no tab lock. */
	const welcome = $derived(page.route.id === '/');
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher defaultTheme={DEFAULT_ACCENT} />
<Toaster richColors closeButton />
{#if welcome}
	{@render children()}
{:else}
	<Boot>{@render children()}</Boot>
{/if}
