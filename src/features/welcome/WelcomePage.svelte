<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check-big';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ScaleIcon from '@lucide/svelte/icons/scale';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { requestDemo } from '$client/demo';
	import { installHow } from '$client/install';
	import { install } from '$client/install.svelte';
	import { ensureServiceWorker } from '$client/sw';
	import { dismissWelcome } from '$client/welcome';
	import { Button } from '$ui/button';
	import * as Select from '$ui/select';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale, locales, setLocale, type Locale } from '$i18n/paraglide/runtime';
	import BrowserWarningDialog from './BrowserWarningDialog.svelte';
	import InstallHelpDialog from './InstallHelpDialog.svelte';
	import WelcomePreview from './WelcomePreview.svelte';

	const REPO = 'https://github.com/flyri0/moneta';
	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

	const points = [
		{ icon: ScaleIcon, text: m.welcome_point_open() },
		{ icon: CloudOffIcon, text: m.welcome_point_private() },
		{ icon: WifiOffIcon, text: m.welcome_point_offline() }
	];

	let helping = $state(false);
	let warning = $state(false);
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

	/** A tab's data can be cleared, so choosing the browser first recommends installing. */
	async function chooseBrowser() {
		let persisted = false;
		try {
			persisted = (await navigator.storage?.persisted?.()) ?? false;
		} catch {
			// Warn, then.
		}
		// Already protected (Chromium trusts this site): there is nothing to warn about.
		if (persisted) useInBrowser();
		else warning = true;
	}

	function installInstead() {
		warning = false;
		void requestInstall();
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

<div class="relative isolate flex min-h-dvh flex-col overflow-clip">
	<div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
		<div class="blob blob-a"></div>
		<div class="blob blob-b"></div>
		<div class="blob blob-c"></div>
	</div>
	<div class="dots pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>

	<main
		class="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 py-6 lg:flex-row lg:gap-16 lg:px-10 [@media(max-height:560px)]:py-3"
	>
		<div
			class="flex w-full max-w-md flex-col items-center gap-5 text-center sm:max-w-2xl lg:max-w-none lg:flex-1 lg:items-start lg:text-left [@media(max-height:560px)]:gap-3"
		>
			<div class="rise flex items-center gap-2.5" style="--d: 0">
				<img src={asset('/icon.svg')} width="36" height="36" alt="" class="size-9 rounded-lg" />
				<span class="text-lg font-semibold tracking-tight">{m.app_name()}</span>
			</div>
			<h1
				class="rise headline text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl [@media(max-height:560px)]:text-3xl"
				style="--d: 1"
			>
				{m.welcome_headline()}
			</h1>
			<p
				class="rise max-w-md text-balance text-muted-foreground sm:text-lg lg:max-w-lg"
				style="--d: 2"
			>
				{m.welcome_tagline()}
			</p>

			{#if install.installed}
				<div class="rise flex max-w-sm flex-col items-center gap-3 lg:items-start" style="--d: 3">
					<h2 class="flex items-center gap-2 font-medium">
						<CheckCircleIcon class="size-5 text-primary" aria-hidden="true" />
						{m.welcome_installed_title()}
					</h2>
					<p class="text-sm text-muted-foreground">{m.welcome_installed_body()}</p>
					<Button variant="outline" onclick={useInBrowser}>{m.welcome_installed_continue()}</Button>
				</div>
			{:else}
				<ul class="rise flex flex-wrap justify-center gap-2 lg:justify-start" style="--d: 3">
					{#each points as point (point.text)}
						<li
							class="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-0.5 text-xs backdrop-blur-sm sm:px-3 sm:py-1 sm:text-sm"
						>
							<point.icon class="size-4 shrink-0 text-primary" aria-hidden="true" />
							{point.text}
						</li>
					{/each}
				</ul>

				<div class="rise grid w-full max-w-xs gap-2 sm:max-w-md sm:grid-cols-2" style="--d: 4">
					<Button size="lg" onclick={requestInstall}>
						<DownloadIcon aria-hidden="true" />
						{m.welcome_install()}
					</Button>
					<Button size="lg" variant="outline" class="bg-background/70" onclick={chooseBrowser}>
						{m.welcome_browser()}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="sm:col-span-2 lg:justify-self-start"
						onclick={tryDemo}
					>
						{m.welcome_demo()}
						<ArrowRightIcon aria-hidden="true" />
					</Button>
				</div>
			{/if}
		</div>

		<!-- Stacked, the preview takes whatever height is left and fades out; it never adds any. -->
		<div
			class="fade hidden min-h-0 w-full max-w-sm grow basis-0 overflow-hidden lg:block lg:max-w-sm lg:shrink-0 lg:grow-0 lg:basis-auto lg:overflow-visible [@media(min-height:720px)]:block"
		>
			<WelcomePreview />
		</div>
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
		<Select.Root
			type="single"
			value={getLocale()}
			onValueChange={(v) => {
				if (v) setLocale(v as Locale);
			}}
		>
			<Select.Trigger size="sm" aria-label={m.settings_language()} class="h-8 w-auto">
				{LANGUAGE_NAMES[getLocale()]}
			</Select.Trigger>
			<Select.Content>
				{#each locales as locale (locale)}
					<Select.Item value={locale} label={LANGUAGE_NAMES[locale]}>
						{LANGUAGE_NAMES[locale]}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</footer>
</div>

<InstallHelpDialog bind:open={helping} {how} />
<BrowserWarningDialog bind:open={warning} onInstall={installInstead} onContinue={useInBrowser} />

<style>
	/* Soft lights in the accent drifting behind the page, and a dot grid that fades out towards the
	   edges. The lights move by transform only, so phones keep them on the compositor. */
	.blob {
		position: absolute;
		width: 70vmax;
		height: 70vmax;
		border-radius: 50%;
		background: radial-gradient(closest-side, var(--light), transparent);
	}

	.blob-a {
		--light: color-mix(in oklab, var(--primary) 26%, transparent);
		top: -35vmax;
		left: -20vmax;
	}

	.blob-b {
		--light: color-mix(in oklab, var(--cat-1) 16%, transparent);
		top: 10vh;
		right: -30vmax;
	}

	.blob-c {
		--light: color-mix(in oklab, var(--cat-3) 16%, transparent);
		bottom: -40vmax;
		left: 15vw;
	}

	.dots {
		background-image: radial-gradient(var(--border) 1px, transparent 1px);
		background-size: 22px 22px;
		mask-image: radial-gradient(ellipse 70% 60% at 50% 35%, black, transparent);
	}

	.headline {
		background: linear-gradient(
			135deg,
			var(--foreground) 40%,
			color-mix(in oklab, var(--primary) 85%, var(--foreground))
		);
		background-clip: text;
		color: transparent;
	}

	.fade {
		mask-image: linear-gradient(to bottom, black 70%, transparent);
	}

	@media (min-width: 1024px) {
		.fade {
			mask-image: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.blob-a {
			animation: drift-a 19s ease-in-out infinite alternate;
		}

		.blob-b {
			animation: drift-b 23s ease-in-out infinite alternate;
		}

		.blob-c {
			animation: drift-c 29s ease-in-out infinite alternate;
		}

		.rise {
			animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
			animation-delay: calc(var(--d) * 0.08s);
		}
	}

	@keyframes drift-a {
		to {
			transform: translate3d(30vw, 15vh, 0) scale(1.15);
		}
	}

	@keyframes drift-b {
		to {
			transform: translate3d(-35vw, 20vh, 0) scale(0.9);
		}
	}

	@keyframes drift-c {
		to {
			transform: translate3d(25vw, -25vh, 0) scale(1.2);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
	}
</style>
