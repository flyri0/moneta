<script lang="ts">
	import './layout.css';
	import '$client/install.svelte';

	import { ModeWatcher, theme } from 'mode-watcher';
	import { onMount, type Snippet, tick, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	import { afterNavigate, beforeNavigate, goto, pushState } from '$app/navigation';
	import { page } from '$app/state';

	import { DEFAULT_ACCENT, readAccent, themeColor } from '$client/accent';
	import { MobileBack } from '$client/mobile-back';
	import { setMobileBack } from '$client/mobile-back.svelte';
	import { overlays } from '$client/overlays.svelte';
	import { toastPlacement } from '$client/toast-placement';

	import Boot from '$components/app/Boot.svelte';

	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	import { Toaster } from '$ui/sonner';

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

	// Toasts on phones sit above the bottom bar, away from open drawers and pickers (`toastPlacement`).
	const desktop = new MediaQuery('min-width: 768px');
	const PENDING_LAYER = 'moneta-mobile-layer';
	function rememberLayer(url: string | null) {
		try {
			if (url) sessionStorage.setItem(PENDING_LAYER, url);
			else sessionStorage.removeItem(PENDING_LAYER);
		} catch {
			// History protection still works when browser storage is unavailable.
		}
	}
	const mobileBack = new MobileBack({
		push: (id) =>
			untrack(() => {
				pushState('', { ...page.state, mobileLayer: id });
				rememberLayer(page.url.href);
			}),
		back: () => history.back(),
		settle: tick
	});
	setMobileBack(mobileBack);
	$effect(() => mobileBack.setMobile(!desktop.current));

	let retrying = false;
	beforeNavigate((navigation) => {
		if (retrying || !mobileBack.protected) return;
		if (navigation.type === 'popstate') {
			// A second gesture while the previous one settles must not leave the form.
			navigation.cancel();
			return;
		}
		if (!navigation.to || navigation.willUnload) return;
		navigation.cancel();
		void mobileBack.clear().then(async () => {
			retrying = true;
			try {
				// The intercepted destination is already resolved by the router.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(navigation.to!.url);
			} finally {
				retrying = false;
			}
		});
	});

	// Old protection entries (Forward, reload or a departed page) never restore a layer.
	function discardOldEntry() {
		if (page.state.mobileLayer && !mobileBack.owns(page.state.mobileLayer)) history.back();
	}
	afterNavigate((navigation) => {
		if (
			navigation.type === 'enter' &&
			(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ===
				'reload'
		) {
			// SvelteKit resets page.state on reload, so remember the disposable entry separately.
			try {
				if (sessionStorage.getItem(PENDING_LAYER) === page.url.href) {
					rememberLayer(null);
					history.back();
					return;
				}
			} catch {
				// Storage may be blocked.
			}
		}
		untrack(discardOldEntry);
	});
	onMount(() => {
		function pop() {
			if (mobileBack.owns(page.state.mobileLayer)) return;
			if (mobileBack.protected) {
				rememberLayer(null);
				void mobileBack.pop();
			} else discardOldEntry();
		}
		// The router installs its listener after mounting the root. Run after it so shallow
		// state is current, and rearm before another browser traversal can leave the document.
		const timer = setTimeout(() => window.addEventListener('popstate', pop), 0);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('popstate', pop);
		};
	});

	const placement = $derived(
		toastPlacement({
			desktop: desktop.current,
			drawers: overlays.drawers,
			pickers: overlays.pickers
		})
	);

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
	position={placement.position}
	offset={placement.offset}
	mobileOffset={placement.offset}
	swipeDirections={placement.swipeDirections}
/>
{#if standalone}
	{@render children()}
{:else}
	<Boot>{@render children()}</Boot>
{/if}
