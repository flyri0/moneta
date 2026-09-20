<script lang="ts">
	import { onMount } from 'svelte';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check-big';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { requestDemo } from '$lib/client/demo';
	import { installHow } from '$lib/client/install';
	import { install } from '$lib/client/install.svelte';
	import { ensureServiceWorker } from '$lib/client/sw';
	import { dismissWelcome } from '$lib/client/welcome';
	import { Button } from '$lib/components/ui/button';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { currentMonth } from '$lib/domain/month';
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime';
	import InstallHelpDialog from './InstallHelpDialog.svelte';

	const REPO = 'https://github.com/flyri0/moneta';
	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

	const points = [
		{ icon: ScaleIcon, text: m.welcome_point_open() },
		{ icon: CloudOffIcon, text: m.welcome_point_private() },
		{ icon: WifiOffIcon, text: m.welcome_point_offline() }
	];

	let helping = $state(false);
	const how = $derived(installHow(navigator.userAgent, install.available));

	// Chromium only offers to install a page whose service worker is registered.
	onMount(ensureServiceWorker);

	$effect(() => {
		if (install.installed) dismissWelcome(localStorage);
	});

	function useInBrowser() {
		dismissWelcome(localStorage);
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	// The demo is not a budget, so the welcome page stays answerable: it is never dismissed here.
	function tryDemo() {
		requestDemo(localStorage);
		void goto(resolve('/budget/[month]', { month: currentMonth() }));
	}

	async function requestInstall() {
		if ((await install.prompt()) !== 'unavailable') return;
		helping = true;
	}
</script>

<div class="flex h-dvh flex-col overflow-hidden">
	<main class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6">
		<header class="flex flex-col items-center gap-3 text-center">
			<img src={asset('/icon.svg')} width="64" height="64" alt="" class="size-14 rounded-xl" />
			<h1 class="text-3xl font-semibold tracking-tight">{m.app_name()}</h1>
			<p class="max-w-xs text-balance text-muted-foreground sm:max-w-sm">{m.welcome_tagline()}</p>
		</header>

		{#if install.installed}
			<div class="flex max-w-xs flex-col items-center gap-3 text-center">
				<CheckCircleIcon class="size-6 text-primary" aria-hidden="true" />
				<h2 class="font-medium">{m.welcome_installed_title()}</h2>
				<p class="text-sm text-muted-foreground">{m.welcome_installed_body()}</p>
				<Button variant="outline" onclick={useInBrowser}>{m.welcome_installed_continue()}</Button>
			</div>
		{:else}
			<ul class="grid w-full max-w-xs gap-3 sm:max-w-sm">
				{#each points as point (point.text)}
					<li class="flex gap-3">
						<point.icon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
						<span class="text-sm text-muted-foreground">{point.text}</span>
					</li>
				{/each}
			</ul>

			<div class="flex w-full max-w-xs flex-col gap-2 sm:max-w-sm">
				<Button size="lg" onclick={requestInstall}>{m.welcome_install()}</Button>
				<Button variant="outline" onclick={useInBrowser}>{m.welcome_browser()}</Button>
				<Button variant="ghost" size="sm" onclick={tryDemo}>{m.welcome_demo()}</Button>
			</div>
		{/if}
	</main>

	<footer
		class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground"
	>
		<a class="underline underline-offset-2 hover:text-foreground" href={REPO}>
			{m.welcome_source()}
		</a>
		<a class="underline underline-offset-2 hover:text-foreground" href="{REPO}/blob/main/LICENSE">
			{m.welcome_license()}
		</a>
		<NativeSelect
			size="sm"
			aria-label={m.settings_language()}
			value={getLocale()}
			onchange={(e) => setLocale(e.currentTarget.value as Locale)}
		>
			{#each locales as locale (locale)}
				<NativeSelectOption value={locale}>{LANGUAGE_NAMES[locale]}</NativeSelectOption>
			{/each}
		</NativeSelect>
	</footer>
</div>

<InstallHelpDialog bind:open={helping} {how} />
