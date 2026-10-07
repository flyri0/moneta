<script lang="ts">
	import { flushSync, type Component } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import DumbbellIcon from '@lucide/svelte/icons/dumbbell';
	import FlagIcon from '@lucide/svelte/icons/flag';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import LampIcon from '@lucide/svelte/icons/lamp';
	import PawPrintIcon from '@lucide/svelte/icons/paw-print';
	import PlaneIcon from '@lucide/svelte/icons/plane';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SmileIcon from '@lucide/svelte/icons/smile';
	import UtensilsIcon from '@lucide/svelte/icons/utensils';
	import * as InputGroup from '$ui/input-group';
	import { Skeleton } from '$ui/skeleton';
	import { Button } from '$ui/button';
	import Delayed from '$components/Delayed.svelte';
	import FormMessage from '$components/FormMessage.svelte';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cn } from '$utils';
	import { emojiKey, loadCatalog, type EmojiCatalog, type EmojiGroupId } from './emoji';
	import { searchEmoji } from './emoji-search';
	import { addRecent, deviceStore, readRecent, readTone, writeTone } from './prefs';
	import { applyTone, type SkinTone } from './skin-tone';

	/**
	 * Picks an emoji from the whole Unicode set: search by name and keyword, a tab per group, a skin
	 * tone for the emoji that take one, and the ones picked last. `onselect` gets the emoji as text,
	 * ready to store. It fills its container: put it in a popover or a screen of its own.
	 */
	let {
		value,
		onselect,
		class: className
	}: {
		/** The emoji picked now, shown as such. */
		value?: string | null;
		onselect: (emoji: string) => void;
		class?: string;
	} = $props();

	type SectionId = EmojiGroupId | 'recent' | 'results';

	interface Item {
		/** What is shown and picked, in the chosen tone. */
		text: string;
		name: string;
		/** The same in every tone, so changing it keeps the buttons. */
		key: string;
	}

	interface Section {
		id: SectionId;
		label: string;
		items: Item[];
		/** The index of its first item among every item shown. */
		start: number;
	}

	const GROUP_ICONS: Record<SectionId, Component> = {
		recent: ClockIcon,
		results: SearchIcon,
		smileys: SmileIcon,
		animals: PawPrintIcon,
		food: UtensilsIcon,
		activities: DumbbellIcon,
		travel: PlaneIcon,
		objects: LampIcon,
		symbols: HeartIcon,
		flags: FlagIcon
	};

	const GROUP_LABELS: Record<SectionId, () => string> = {
		recent: m.emoji_group_recent,
		results: m.emoji_group_results,
		smileys: m.emoji_group_smileys,
		animals: m.emoji_group_animals,
		food: m.emoji_group_food,
		activities: m.emoji_group_activities,
		travel: m.emoji_group_travel,
		objects: m.emoji_group_objects,
		symbols: m.emoji_group_symbols,
		flags: m.emoji_group_flags
	};

	const TONE_LABELS = [
		m.emoji_tone_0,
		m.emoji_tone_1,
		m.emoji_tone_2,
		m.emoji_tone_3,
		m.emoji_tone_4,
		m.emoji_tone_5
	];
	const TONES: SkinTone[] = [0, 1, 2, 3, 4, 5];
	/** The emoji the skin tone control shows. */
	const TONE_SAMPLE = '✋';
	/** How far past the visible part of the list rows are drawn, in px, so scrolling finds them. */
	const OVERSCAN = 160;
	/** Below the bottom of every group, in px. */
	const SECTION_GAP = 4;

	const store = deviceStore();
	let catalog = $state<EmojiCatalog | null>(null);
	let failed = $state<unknown>(undefined);
	let query = $state('');
	let tone = $state<SkinTone>(readTone(store));
	let recent = $state(readRecent(store));
	let choosingTone = $state(false);
	/** The item Tab lands on in the grid: the rest are reached with the arrow keys. */
	let active = $state(0);
	/** The item under the pointer or focus, named in the footer. */
	let previewed = $state<Item | null>(null);
	let current = $state<SectionId>('smileys');
	let body = $state<HTMLElement | null>(null);
	let toneButton = $state<HTMLElement | null>(null);
	const desktop = new MediaQuery('min-width: 768px');
	let scrollTop = $state(0);
	/** The list's size on screen and a group header's height, which the grid is laid out from. */
	let viewport = $state<{ width: number; height: number; header: number } | null>(null);

	loadCatalog(getLocale()).then(
		(loaded) => (catalog = loaded),
		(error: unknown) => (failed = error)
	);

	const sections = $derived.by((): Section[] => {
		if (!catalog) return [];
		const list: Omit<Section, 'start'>[] = [];
		const q = query.trim();
		if (q) {
			const items = searchEmoji(catalog.all, q).map((e) => ({
				text: catalog!.tone(e, tone),
				name: e.name,
				key: e.emoji
			}));
			list.push({ id: 'results', label: GROUP_LABELS.results(), items });
		} else {
			if (recent.length > 0) {
				const items = recent.map((text) => ({
					text,
					name: catalog!.find(text)?.name ?? text,
					key: text
				}));
				list.push({ id: 'recent', label: GROUP_LABELS.recent(), items });
			}
			for (const group of catalog.groups) {
				const items = group.emojis.map((e) => ({
					text: catalog!.tone(e, tone),
					name: e.name,
					key: e.emoji
				}));
				list.push({ id: group.id, label: GROUP_LABELS[group.id](), items });
			}
		}
		let start = 0;
		return list.map((section) => {
			const withStart = { ...section, start };
			start += section.items.length;
			return withStart;
		});
	});

	const count = $derived(sections.reduce((n, s) => n + s.items.length, 0));
	const valueKey = $derived(value ? emojiKey(value) : '');
	const footer = $derived(
		previewed ?? (value ? { text: value, name: catalog?.find(value)?.name ?? '' } : null)
	);

	/**
	 * The grid laid out in rows of one height, as CSS would. Only the rows near the visible part of
	 * the list are drawn: with all 1,900 emoji in the page, every scroll lays out and paints them
	 * again, which Chrome does slowly.
	 */
	const grid = $derived.by(() => {
		if (!viewport) return null;
		const minCell = (desktop.current ? 2.25 : 2.75) * remPx();
		const width = Math.max(0, viewport.width - 16);
		const columns = Math.max(1, Math.floor(width / minCell));
		const cell = width / columns;
		let top = 0;
		const layout = sections.map((section) => {
			const header = section.id === 'results' ? 0 : viewport!.header;
			const rows = Math.ceil(section.items.length / columns);
			const placed = { top, header, rows, height: header + rows * cell + SECTION_GAP };
			top += placed.height;
			return placed;
		});
		return { columns, cell, layout };
	});

	/** The rows each section draws: those near the visible part, and the one Tab lands on. */
	const drawn = $derived.by((): number[][] => {
		if (!grid || !viewport) return sections.map(() => []);
		const from = scrollTop - OVERSCAN;
		const to = scrollTop + viewport.height + OVERSCAN;
		return sections.map((section, i) => {
			const { top, header, rows } = grid.layout[i];
			const first = Math.max(0, Math.floor((from - top - header) / grid.cell));
			const last = Math.min(rows - 1, Math.floor((to - top - header) / grid.cell));
			const list: number[] = [];
			for (let r = first; r <= last; r++) list.push(r);
			const activeRow = Math.floor((active - section.start) / grid.columns);
			if (active >= section.start && activeRow < rows && !list.includes(activeRow))
				list.push(activeRow);
			return list;
		});
	});

	/** The size of 1rem in px. */
	function remPx(): number {
		return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	}

	// A new search starts again from the top.
	$effect(() => {
		void query;
		active = 0;
		if (body) body.scrollTop = 0;
		scrollTop = 0;
	});

	function pick(item: Item) {
		// Only stored: the picker closes on a pick, and updating `recent` or `query` here would redraw
		// the ~1,900 emoji (every index after the new Recent group shifts) just before it goes away.
		addRecent(store, item.text);
		onselect(item.text);
	}

	function chooseTone(next: SkinTone) {
		tone = next;
		writeTone(store, next);
		choosingTone = false;
		toneButton?.focus();
	}

	/** Scrolls a group to the top, and makes its first emoji the one Tab lands on. */
	function jumpTo(section: Section) {
		const i = sections.indexOf(section);
		if (!grid || i < 0) return;
		scrollTo(grid.layout[i].top);
		current = section.id;
		active = section.start;
	}

	function scrollTo(top: number) {
		if (!body) return;
		body.scrollTop = top;
		scrollTop = body.scrollTop;
	}

	/** Draws the rows now in view, and marks the group at the top of the list as the current tab. */
	function onscroll() {
		if (!body) return;
		scrollTop = body.scrollTop;
		if (!grid) return;
		let next = sections[0]?.id;
		sections.forEach((section, i) => {
			if (grid!.layout[i].top <= scrollTop + 4) next = section.id;
		});
		if (next) current = next;
	}

	function itemAt(index: number): HTMLElement | null {
		return body?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null;
	}

	/** Focuses an emoji, scrolled into view below its group's header and drawn first. */
	function focusItem(index: number) {
		const next = Math.max(0, Math.min(count - 1, index));
		active = next;
		const i = sections.findLastIndex((s) => s.start <= next);
		if (grid && viewport && i >= 0) {
			const { top, header } = grid.layout[i];
			const y = top + header + Math.floor((next - sections[i].start) / grid.columns) * grid.cell;
			if (y - header < scrollTop) scrollTo(y - header);
			else if (y + grid.cell > scrollTop + viewport.height)
				scrollTo(y + grid.cell - viewport.height);
		}
		flushSync();
		itemAt(next)?.focus({ preventScroll: true });
	}

	/** Arrow keys move through the emoji as one grid, Home and End to the ends. */
	function onGridKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const index = Number(target.dataset.index);
		if (Number.isNaN(index)) return;
		const step: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -(grid?.columns ?? 1),
			ArrowDown: grid?.columns ?? 1,
			Home: -index,
			End: count - 1 - index
		};
		if (!(event.key in step)) return;
		event.preventDefault();
		focusItem(index + step[event.key]);
	}

	/** Down goes from the search into the emoji; Enter picks the first result. */
	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && count > 0) {
			event.preventDefault();
			focusItem(0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const first = query.trim() ? sections[0]?.items[0] : undefined;
			if (first) pick(first);
		}
	}

	/** Left and right move through the tones, as in any group of radio buttons. */
	function onToneKeydown(event: KeyboardEvent, index: number) {
		const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			choosingTone = false;
			toneButton?.focus();
			return;
		}
		if (step === undefined) return;
		event.preventDefault();
		const next = (index + step + TONES.length) % TONES.length;
		const group = (event.currentTarget as HTMLElement).parentElement;
		group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
	}

	/** The index of the emoji button `event` happened on, if any. */
	function indexFrom(event: Event): number | null {
		const el = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
		return el ? Number(el.dataset.index) : null;
	}

	function itemAtIndex(index: number | null): Item | null {
		if (index === null) return null;
		const section = sections.findLast((s) => s.start <= index);
		return section?.items[index - section.start] ?? null;
	}

	function onGridFocusin(event: FocusEvent) {
		const index = indexFrom(event);
		if (index !== null) active = index;
		previewed = itemAtIndex(index);
	}

	function onGridClick(event: MouseEvent) {
		const item = itemAtIndex(indexFrom(event));
		if (item) pick(item);
	}

	/** Measures the list and a group's header, which the grid is laid out from. */
	function measure() {
		if (!body) return;
		const header = body.querySelector<HTMLElement>('h3:not(.sr-only)')?.offsetHeight;
		const next = {
			width: body.clientWidth,
			height: body.clientHeight,
			header: header ?? viewport?.header ?? 28
		};
		if (JSON.stringify(next) !== JSON.stringify(viewport)) viewport = next;
	}

	$effect(() => {
		if (!body) return;
		const observer = new ResizeObserver(measure);
		observer.observe(body);
		return () => observer.disconnect();
	});

	$effect(() => {
		void sections;
		measure();
	});
</script>

<div class={cn('flex min-h-0 flex-col', className)} data-emoji-picker>
	<div class="flex shrink-0 items-center gap-1 p-2 pb-1">
		<InputGroup.Root class="h-9 md:h-8">
			<InputGroup.Addon>
				<SearchIcon class="size-4 shrink-0 opacity-50" />
			</InputGroup.Addon>
			<InputGroup.Input
				type="search"
				class="[&::-webkit-search-cancel-button]:hidden"
				bind:value={query}
				placeholder={m.emoji_search()}
				aria-label={m.emoji_search()}
				autocomplete="off"
				spellcheck={false}
				enterkeyhint="done"
				onkeydown={onSearchKeydown}
			/>
		</InputGroup.Root>
		<Button
			bind:ref={toneButton}
			variant="ghost"
			size="icon"
			class="size-9 shrink-0 text-lg md:size-8"
			aria-label={m.emoji_skin_tone({ tone: TONE_LABELS[tone]() })}
			aria-expanded={choosingTone}
			onclick={() => (choosingTone = !choosingTone)}
		>
			<span aria-hidden="true">{applyTone(TONE_SAMPLE, tone)}</span>
		</Button>
	</div>

	{#if choosingTone}
		<div
			class="flex shrink-0 justify-between gap-1 border-b px-2 pb-1"
			role="radiogroup"
			aria-label={m.emoji_skin_tones()}
		>
			{#each TONES as option, i (option)}
				<button
					type="button"
					role="radio"
					aria-checked={option === tone}
					aria-label={TONE_LABELS[option]()}
					title={TONE_LABELS[option]()}
					tabindex={option === tone ? 0 : -1}
					class="flex size-11 items-center justify-center rounded-md text-xl transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-accent md:size-9"
					onclick={() => chooseTone(option)}
					onkeydown={(event) => onToneKeydown(event, i)}
				>
					<span aria-hidden="true">{applyTone(TONE_SAMPLE, option)}</span>
				</button>
			{/each}
		</div>
	{:else if !query.trim()}
		<nav class="flex shrink-0 justify-between border-b px-1" aria-label={m.emoji_groups()}>
			{#each sections as section (section.id)}
				{@const Icon = GROUP_ICONS[section.id]}
				<button
					type="button"
					class="relative flex h-9 min-w-0 flex-1 items-center justify-center text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:text-foreground aria-[current=true]:after:absolute aria-[current=true]:after:inset-x-1.5 aria-[current=true]:after:bottom-0 aria-[current=true]:after:h-0.5 aria-[current=true]:after:rounded-full aria-[current=true]:after:bg-primary md:h-8"
					aria-label={section.label}
					title={section.label}
					aria-current={section.id === current}
					onclick={() => jumpTo(section)}
				>
					<Icon class="size-4" />
				</button>
			{/each}
		</nav>
	{/if}

	<!-- Its handlers serve the emoji buttons inside: picking, arrow keys, and naming the one pointed
	at. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={body}
		class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]"
		{onscroll}
		onclick={onGridClick}
		onkeydown={onGridKeydown}
		onpointerover={(event) => (previewed = itemAtIndex(indexFrom(event)))}
		onpointerleave={() => (previewed = null)}
		onfocusin={onGridFocusin}
		onfocusout={() => (previewed = null)}
	>
		{#if failed !== undefined}
			<FormMessage class="px-4 py-2" error={{ message: m.emoji_load_failed(), cause: failed }} />
		{:else if !catalog}
			<Delayed>
				<div class="grid animate-in grid-cols-8 gap-1 px-2 pt-2 fade-in" aria-hidden="true">
					{#each { length: 32 }, i (i)}
						<Skeleton class="aspect-square" />
					{/each}
				</div>
			</Delayed>
		{:else if count === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">{m.emoji_empty()}</p>
		{:else}
			{#each sections as section, s (section.id)}
				<section
					data-section={section.id}
					aria-labelledby="emoji-section-{section.id}"
					class="relative"
					style:height={grid ? `${grid.layout[s].height}px` : undefined}
				>
					<h3
						id="emoji-section-{section.id}"
						class={cn(
							'sticky top-0 z-10 bg-popover px-2 py-1.5 text-xs font-medium text-muted-foreground',
							section.id === 'results' && 'sr-only'
						)}
					>
						{section.label}
					</h3>
					{#if grid}
						<!-- Only the rows near the visible part are drawn, each where it would sit. -->
						{#each drawn[s] as row (row)}
							<div
								class="absolute inset-x-2 grid"
								style:top="{grid.layout[s].header + row * grid.cell}px"
								style:height="{grid.cell}px"
								style:grid-template-columns="repeat({grid.columns}, minmax(0, 1fr))"
							>
								{#each section.items.slice(row * grid.columns, (row + 1) * grid.columns) as item, i (item.key)}
									{@const index = section.start + row * grid.columns + i}
									<button
										type="button"
										data-index={index}
										tabindex={index === active ? 0 : -1}
										aria-label={item.name}
										aria-current={emojiKey(item.text) === valueKey ? 'true' : undefined}
										class="flex items-center justify-center rounded-md text-2xl leading-none transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-accent md:text-xl"
									>
										{item.text}
									</button>
								{/each}
							</div>
						{/each}
					{/if}
				</section>
			{/each}
		{/if}
	</div>

	<div
		class="hidden h-10 shrink-0 items-center gap-2 border-t px-3 text-sm md:flex"
		aria-hidden="true"
	>
		{#if footer}
			<span class="text-xl leading-none">{footer.text}</span>
			<span class="min-w-0 truncate text-muted-foreground">{footer.name}</span>
		{/if}
	</div>
</div>
