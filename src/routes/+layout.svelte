<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { DEFAULT_ACCENT } from '$client/accent';
	import '$client/install.svelte';
	import { Toaster } from '$ui/sonner';
	import Boot from '$components/app/Boot.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();

	/** The welcome and error pages are not the app: they open no database and claim no tab lock. */
	const standalone = $derived(page.route.id === '/' || page.error !== null);
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher defaultTheme={DEFAULT_ACCENT} />
<Toaster richColors closeButton />
{#if standalone}
	{@render children()}
{:else}
	<Boot>{@render children()}</Boot>
{/if}
