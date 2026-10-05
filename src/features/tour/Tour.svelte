<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$ui/button';
	import HelpLink from '$components/HelpLink.svelte';
	import { scrollLimits } from '$features/budget/sortable.svelte';
	import { cloudProviders } from '$features/backup/cloud/cloud.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { guidePath } from '$client/guide';
	import { settleTour, tourPendingFor } from '$client/tour';
	import { VisibleArea } from '$client/visible-area.svelte';
	import { currentMonth } from '$domain/month';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import {
		placeCard,
		resolveStep,
		TOUR_ROUTE_IDS,
		TOUR_STEPS,
		type Box,
		type ResolvedStep,
		type TourCopy,
		type TourLayout,
		type TourTarget
	} from './steps';
	import { tour } from './tour.svelte';

	/**
	 * The first-budget tour: a dimmed page with one element lit, and a card explaining it. It
	 * starts on the budget screen, once, for the budget onboarding planned it for (or again when
	 * Settings asks), and opens the other screens it shows, lighting the way into each first. The
	 * page behind is inert while it shows (the shell sets `inert` from `tour`) and doesn't scroll
	 * by hand: on a phone that would hide or show the browser's toolbar under the spotlight.
	 */

	const TEXT: Record<TourCopy, { title: () => string; body: () => string }> = {
		intro: { title: () => m.tour_intro_title(), body: () => m.tour_intro_body() },
		rta: { title: () => m.tour_rta_title(), body: () => m.tour_rta_body() },
		category: { title: () => m.tour_category_title(), body: () => m.tour_category_body() },
		'category-wide': {
			title: () => m.tour_category_title(),
			body: () => m.tour_category_wide_body()
		},
		'add-group': { title: () => m.tour_category_title(), body: () => m.tour_add_group_body() },
		'add-transaction': {
			title: () => m.tour_add_transaction_title(),
			body: () => m.tour_add_transaction_body()
		},
		accounts: { title: () => m.tour_accounts_title(), body: () => m.tour_accounts_body() },
		schedules: { title: () => m.tour_schedules_title(), body: () => m.tour_schedules_body() },
		'schedules-way': {
			title: () => m.tour_schedules_way_title(),
			body: () => m.tour_schedules_way_body()
		},
		'schedules-way-phone': {
			title: () => m.tour_schedules_way_title(),
			body: () => m.tour_schedules_way_phone_body()
		},
		month: { title: () => m.tour_month_title(), body: () => m.tour_month_body() },
		'reports-way': {
			title: () => m.tour_reports_way_title(),
			body: () => m.tour_reports_way_body()
		},
		reports: { title: () => m.tour_reports_title(), body: () => m.tour_reports_body() },
		'settings-way': {
			title: () => m.tour_settings_way_title(),
			body: () => m.tour_settings_way_body()
		},
		backup: { title: () => m.tour_backup_title(), body: () => m.tour_backup_body() },
		'backup-cloud': { title: () => m.tour_backup_title(), body: () => m.tour_backup_cloud_body() },
		done: { title: () => m.tour_done_title(), body: () => m.tour_done_body() }
	};

	/** Room around the lit element, so its edges and focus ring stay inside the light. */
	const PADDING = 6;
	const LAST = TOUR_STEPS.length - 1;

	const session = useSession();
	// The budget grid's own breakpoint for its inline Assigned column.
	const wideGrid = new MediaQuery('min-width: 1024px');
	const phone = new MediaQuery('max-width: 767.98px');
	const area = new VisibleArea();
	const cloud = cloudProviders().length > 0;

	/** Whether this budget is the one the tour waits for. Read again for each budget. */
	let pending = $derived(!session.isDemo && tourPendingFor(localStorage, session.file));

	const onBudget = $derived(page.route.id === TOUR_ROUTE_IDS.budget);

	let resolved = $state<ResolvedStep<Element> | null>(null);
	let box = $state<Box | null>(null);
	let card = $state<HTMLElement>();
	let cardWidth = $state(0);
	let cardHeight = $state(0);
	let viewportWidth = $state(0);
	/** What had the focus before the tour, to give it back after. */
	let returnFocus: Element | null = null;
	/** The budget month the tour started on, to come back to. */
	let month = currentMonth();
	/** Set while the tour opens the next step's screen, which isn't the user leaving it. */
	let moving = false;

	// Starts once the budget has drawn, so its elements can be found.
	$effect(() => {
		if (tour.step !== null || !onBudget || !(pending || tour.replay)) return;
		const ready = () => document.querySelector('[data-tour="rta"]') !== null;
		const start = () => {
			returnFocus = document.activeElement;
			month = page.params.month ?? currentMonth();
			tour.step = 0;
		};
		if (ready()) {
			start();
			return;
		}
		const observer = new MutationObserver(() => {
			if (!ready()) return;
			observer.disconnect();
			start();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	});

	// A screen the tour didn't open: the browser's back or forward button moves the tour along with
	// it, onto the step next door on that screen; anything else (a toast's link) puts it away. The
	// planned one starts over on the budget; a replay was a one-off request. Only a change of screen
	// runs this.
	$effect(() => {
		const id = page.route.id;
		untrack(() => {
			const step = tour.step;
			if (moving) return;
			const on = (index: number) => TOUR_ROUTE_IDS[TOUR_STEPS[index].route] === id;
			if (step === null ? id === TOUR_ROUTE_IDS.budget : on(step)) return;
			if (step !== null && step > 0 && on(step - 1)) tour.step = step - 1;
			else if (step !== null && step < LAST && on(step + 1)) tour.step = step + 1;
			else {
				tour.replay = false;
				tour.step = null;
			}
		});
	});

	// The page doesn't scroll by hand while the tour shows; the tour still scrolls it to each step.
	$effect(() => {
		if (tour.step === null) return;
		const root = document.documentElement;
		const before = root.style.overflow;
		root.style.overflow = 'hidden';
		return () => {
			root.style.overflow = before;
		};
	});

	// The state outlives the shell, which another budget or a lost tab lock replaces.
	onDestroy(() => {
		tour.replay = false;
		tour.step = null;
	});

	/** The element shown for a target: of the copies in the page (the phone's and the sidebar's), the visible one. */
	function find(target: TourTarget): Element | null {
		for (const element of document.querySelectorAll(`[data-tour="${target}"]`)) {
			if (element.getClientRects().length > 0) return element;
		}
		return null;
	}

	function layout(): TourLayout {
		return { wide: wideGrid.current, cloud };
	}

	function refind(step: number) {
		resolved = resolveStep(TOUR_STEPS[step], find, layout());
	}

	/** Scrolls the element into the band between the sticky bars, when it isn't already there. */
	function bringIntoView(element: Element) {
		const rect = element.getBoundingClientRect();
		const { top, bottom } = scrollLimits();
		if (rect.top >= top && rect.bottom <= bottom) return;
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		element.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
	}

	function measure(): Box | null {
		const element = resolved?.element;
		if (!element) return null;
		const rect = element.getBoundingClientRect();
		return {
			x: rect.x - PADDING,
			y: rect.y - PADDING,
			width: rect.width + PADDING * 2,
			height: rect.height + PADDING * 2
		};
	}

	function same(a: Box | null, b: Box | null): boolean {
		if (!a || !b) return a === b;
		return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
	}

	// Each step: find its element and bring it into view. The focus goes to the card when it opens,
	// and stays on the button that moved on unless that button is gone.
	$effect(() => {
		const step = tour.step;
		if (step === null) {
			resolved = null;
			box = null;
			return;
		}
		const next = resolveStep(TOUR_STEPS[step], find, layout());
		resolved = next;
		if (next.element) bringIntoView(next.element);
		void tick().then(() => {
			if (card && !card.contains(document.activeElement)) card.focus();
		});
	});

	// Follows the element every frame while the tour shows: scrolling, resizing, the keyboard,
	// a re-render that replaces it, a layout that swaps it for another copy, or a screen the tour
	// just opened that draws it a moment later.
	$effect(() => {
		const step = tour.step;
		if (step === null) return;
		let frame = requestAnimationFrame(function follow() {
			const element = resolved?.element;
			const { target, fallback } = TOUR_STEPS[step];
			const gone = element && (!element.isConnected || element.getClientRects().length === 0);
			// A fallback stands in only until the step's own target shows up.
			const upgrade = fallback && resolved?.copy === fallback.copy && target && find(target);
			if (gone || upgrade || (!element && target)) {
				refind(step);
				if (!element && resolved?.element) bringIntoView(resolved.element);
			}
			const next = measure();
			if (!same(next, box)) box = next;
			frame = requestAnimationFrame(follow);
		});
		return () => cancelAnimationFrame(frame);
	});

	// Placed within the part of the window the user sees, which a phone's toolbar can change.
	const position = $derived.by(() => {
		const { top, height } = area.current;
		const placed = placeCard(
			box && { ...box, y: box.y - top },
			{ width: cardWidth, height: cardHeight },
			{ width: viewportWidth, height },
			phone.current
		);
		return { x: placed.x, y: placed.y + top, maxHeight: height - 32 };
	});

	/** Ends the tour. The planned one is over for good, however it ended. */
	function close() {
		if (pending) {
			settleTour(localStorage);
			pending = false;
		}
		tour.replay = false;
		tour.step = null;
		if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
		returnFocus = null;
	}

	/** Opens a step's screen. */
	function open(step: number): Promise<void> {
		const screen = TOUR_STEPS[step].route;
		if (screen === 'budget') return goto(resolve('/budget/[month]', { month }));
		return goto(resolve(TOUR_ROUTE_IDS[screen]));
	}

	/** Goes to a step, opening its screen first when it is on another one. */
	async function show(step: number) {
		if (TOUR_STEPS[step].route === TOUR_STEPS[tour.step ?? step].route) {
			tour.step = step;
			return;
		}
		moving = true;
		try {
			await open(step);
		} finally {
			moving = false;
		}
		if (tour.step !== null) tour.step = step;
	}

	function next() {
		if (tour.step === null || moving) return;
		if (tour.step >= LAST) close();
		else void show(tour.step + 1);
	}

	function back() {
		if (tour.step === null || tour.step === 0 || moving) return;
		// The way back across screens is the browser's: the screen-change effect follows it.
		if (TOUR_STEPS[tour.step - 1].route !== TOUR_STEPS[tour.step].route) history.back();
		else tour.step -= 1;
	}

	function onkeydown(event: KeyboardEvent) {
		if (tour.step === null) return;
		if (event.key === 'Escape') close();
		else if (event.key === 'ArrowRight') next();
		else if (event.key === 'ArrowLeft') back();
		else return;
		event.preventDefault();
	}

	const text = $derived(resolved ? TEXT[resolved.copy] : null);
</script>

<svelte:window {onkeydown} bind:innerWidth={viewportWidth} />

{#if tour.step !== null && resolved && text}
	<div class="fixed inset-0 z-[70] touch-none overscroll-none" data-testid="tour">
		{#if box}
			<div
				class="pointer-events-none fixed rounded-xl ring-2 ring-primary outline-[200vmax] outline-black/50 outline-solid"
				style:left="{box.x}px"
				style:top="{box.y}px"
				style:width="{box.width}px"
				style:height="{box.height}px"
				data-testid="tour-spotlight"
			></div>
		{:else}
			<div class="fixed inset-0 bg-black/50"></div>
		{/if}

		<div
			bind:this={card}
			bind:offsetWidth={cardWidth}
			bind:offsetHeight={cardHeight}
			role="dialog"
			aria-modal="true"
			aria-labelledby="tour-title"
			aria-describedby="tour-body"
			tabindex="-1"
			class="fixed grid w-[calc(100vw-2rem)] touch-pan-y gap-3 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none md:w-96"
			class:invisible={cardHeight === 0}
			style:left="{position.x}px"
			style:top="{position.y}px"
			style:max-height="{position.maxHeight}px"
			data-testid="tour-card"
		>
			<!-- Read out when a step changes while the focus stays on its buttons. -->
			<div class="grid gap-1" aria-live="polite">
				{#if tour.step > 0}
					<p class="text-xs text-muted-foreground tabular-nums">
						{m.tour_progress({ current: tour.step, total: LAST })}
					</p>
				{/if}
				<h2 id="tour-title" class="text-base font-semibold">{text.title()}</h2>
				<p id="tour-body" class="text-sm text-muted-foreground">{text.body()}</p>
				{#if resolved.topic}
					<HelpLink topic={resolved.topic} text class="mt-1 justify-self-start" />
				{/if}
			</div>

			<div class="flex items-center justify-between gap-2">
				{#if tour.step < LAST}
					<Button variant="ghost" size="sm" onclick={close}>{m.tour_skip()}</Button>
				{:else}
					<!-- The guide is plain pages from the host, outside the app: resolve() only knows the app's routes. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<Button
						variant="ghost"
						size="sm"
						href={guidePath(getLocale())}
						target="_blank"
						rel="noopener"
						onclick={close}
					>
						{m.tour_open_guide()}
					</Button>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
				<div class="flex gap-2">
					{#if tour.step > 0}
						<Button variant="outline" size="sm" onclick={back}>{m.tour_back()}</Button>
					{/if}
					<Button size="sm" onclick={next}>
						{#if tour.step === 0}
							{m.tour_start()}
						{:else if tour.step === LAST}
							{m.tour_finish()}
						{:else}
							{m.tour_next()}
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
