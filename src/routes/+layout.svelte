<script lang="ts">
	import './layout.css';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { ModeWatcher, theme } from 'mode-watcher';
	import { page } from '$app/state';
	import { DEFAULT_ACCENT, readAccent, themeColor } from '$client/accent';
	import '$client/install.svelte';
	import { Toaster } from '$ui/sonner';
	import Boot from '$components/app/Boot.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	let { children }: { children: Snippet } = $props();

	// The app is a client-only SPA, so the document is always there.
	document.documentElement.lang = getLocale();

	/**
	 * The welcome, sign-in callback and error pages are not the app: they open no database and claim
	 * no tab lock.
	 */
	const standalone = $derived(
		page.route.id === '/' || page.route.id === '/oauth/callback' || page.error !== null
	);

	// Toasts sit at the top on phones, clear of the bottom nav and the floating add button (and
	// below the demo banner, through --app-top).
	const desktop = new MediaQuery('min-width: 768px');

	// The system bar around the installed app takes the accent, as soon as it is picked.
	$effect(() => {
		const color = themeColor(readAccent(theme.current));
		if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
	});
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

<ModeWatcher defaultTheme={DEFAULT_ACCENT} />
<Toaster
	closeButton
	position={desktop.current ? 'bottom-right' : 'top-center'}
	mobileOffset={{ top: 'calc(var(--app-top, env(safe-area-inset-top)) + 0.75rem)' }}
/>
{#if standalone}
	{@render children()}
{:else}
	<Boot>{@render children()}</Boot>
{/if}
