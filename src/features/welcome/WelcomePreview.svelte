<!-- A picture of the budget screen for the welcome page, drawn with the app's own tones. Decorative. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { RTA_CARD, RTA_ICON, RTA_TEXT, TONE_BAR, TONE_PILL } from '$features/budget/tones';
	import type { AvailableTone } from '$features/budget/view';
	import { currencyDigits, formatMoney } from '$domain/money';
	import { currentMonth } from '$domain/month';
	import { formatMonthLong, suggestCurrency } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	const locale = previewLocale();
	const currency = suggestCurrency(locale);
	const scale = 10 ** currencyDigits(currency);
	const money = (major: number) => formatMoney(major * scale, { currency, locale });

	const rows: { name: string; funded: number; spent: number }[] = [
		{ name: m.default_category_rent(), funded: 1200, spent: 1200 },
		{ name: m.default_category_groceries(), funded: 600, spent: 372 },
		{ name: m.default_category_dining_out(), funded: 150, spent: 184 },
		{ name: m.default_category_utilities(), funded: 220, spent: 96 }
	];
	const income = rows.reduce((sum, row) => sum + row.funded, 0);

	// The month plays out once: the income arrives, every unit gets a job, then some of it is spent.
	// Without motion it starts where it ends.
	const still = prefersReducedMotion.current;
	const assigning = new Tween(still ? 1 : 0, { duration: 1600, easing: cubicInOut });
	const spending = new Tween(still ? 1 : 0, { duration: 1500, easing: cubicOut });

	onMount(() => {
		if (still) return;
		let cancelled = false;
		const timer = setTimeout(async () => {
			await assigning.set(1);
			if (!cancelled) await spending.set(1, { delay: 300 });
		}, 900);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	/** Where row `i` is in a phase at `progress`: rows follow one another, a little apart. */
	function step(progress: number, i: number): number {
		return Math.min(1, Math.max(0, progress * (1 + 0.2 * (rows.length - 1)) - 0.2 * i));
	}

	const shown = $derived(
		rows.map((row, i) => {
			const funded = Math.round(row.funded * step(assigning.current, i));
			const spent = Math.round(row.spent * step(spending.current, i));
			const available = funded - spent;
			return {
				name: row.name,
				funded,
				spent,
				available,
				tone: tone(available),
				percent: funded > 0 ? Math.min(100, (spent / funded) * 100) : 0
			};
		})
	);
	const readyToAssign = $derived(income - shown.reduce((sum, row) => sum + row.funded, 0));
	const rtaTone = $derived(readyToAssign > 0 ? 'unassigned' : 'assigned');
	const Icon = $derived(RTA_ICON[rtaTone]);

	/** The browser's number format when it speaks the UI language (en-GB shows pounds), else the UI's. */
	function previewLocale(): string {
		const ui = getLocale();
		try {
			const browser = Intl.getCanonicalLocales(navigator.language)[0];
			if (browser?.split('-')[0] === ui.split('-')[0]) return browser;
		} catch {
			// Not a locale Intl knows.
		}
		return ui;
	}

	function tone(available: number): AvailableTone {
		return available > 0 ? 'positive' : available < 0 ? 'overspent' : 'zero';
	}
</script>

<div
	class="preview overflow-hidden rounded-2xl border bg-card text-left text-card-foreground shadow-2xl"
	aria-hidden="true"
>
	<div class="flex items-center justify-between border-b px-4 py-2.5 text-muted-foreground">
		<ChevronLeftIcon class="size-4" />
		<span class="inline-block font-semibold text-foreground first-letter:uppercase">
			{formatMonthLong(currentMonth(), locale)}
		</span>
		<ChevronRightIcon class="size-4" />
	</div>

	<div class="p-3">
		<div
			class="grid gap-1 rounded-xl border p-3 transition-colors duration-500 {RTA_CARD[rtaTone]}"
		>
			<span
				class="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>
				<Icon class="size-4 shrink-0 {RTA_TEXT[rtaTone]}" />
				{m.budget_ready_to_assign()}
			</span>
			<span class="text-2xl font-bold tracking-tight tabular-nums {RTA_TEXT[rtaTone]}">
				{money(readyToAssign)}
			</span>
			<span class="text-sm {RTA_TEXT[rtaTone]}">
				{rtaTone === 'assigned' ? m.budget_rta_assigned_hint() : m.budget_rta_unassigned_hint()}
			</span>
		</div>
	</div>

	<div class="divide-y border-t">
		{#each shown as row (row.name)}
			<div class="grid gap-2 px-4 py-3">
				<div class="flex items-center justify-between gap-3">
					<span class="truncate text-sm font-medium">{row.name}</span>
					<span
						class="rounded-full px-2 py-0.5 text-sm font-medium tabular-nums transition-colors duration-300 {TONE_PILL[
							row.tone
						]}"
					>
						{money(row.available)}
					</span>
				</div>
				<div class="h-1.5 rounded-full bg-muted">
					<div
						class="h-full rounded-full transition-colors duration-300 {TONE_BAR[row.tone]}"
						style="width: {row.percent}%"
					></div>
				</div>
				<p class="text-xs text-muted-foreground tabular-nums [@media(max-height:700px)]:hidden">
					{row.available < 0
						? m.budget_progress_over({ spent: money(row.spent), over: money(-row.available) })
						: m.budget_progress_spent({ spent: money(row.spent), funded: money(row.funded) })}
				</p>
			</div>
		{/each}
	</div>
</div>

<style>
	@media (prefers-reduced-motion: no-preference) {
		.preview {
			animation: rise 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.25s both;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1.5rem);
		}
	}
</style>
