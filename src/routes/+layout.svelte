<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher />
<Toaster richColors closeButton />
{@render children()}
