<script lang="ts">
	import type { Component } from 'svelte';
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
				name: e.name
			}));
			list.push({ id: 'results', label: GROUP_LABELS.results(), items });
		} else {
			if (recent.length > 0) {
				const items = recent.map((text) => ({ text, name: catalog!.find(text)?.name ?? text }));
				list.push({ id: 'recent', label: GROUP_LABELS.recent(), items });
			}
			for (const group of catalog.groups) {
				const items = group.emojis.map((e) => ({ text: catalog!.tone(e, tone), name: e.name }));
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

	// A new search starts again from the top.
	$effect(() => {
		void query;
		active = 0;
		if (body) body.scrollTop = 0;
	});

	function pick(item: Item) {
		recent = addRecent(store, item.text);
		query = '';
		onselect(item.text);
	}

	function chooseTone(next: SkinTone) {
		tone = next;
		writeTone(store, next);
		choosingTone = false;
		toneButton?.focus();
	}

	function sectionElement(id: SectionId): HTMLElement | null {
		return body?.querySelector<HTMLElement>(`[data-section="${id}"]`) ?? null;
	}

	/** Scrolls a group to the top, and makes its first emoji the one Tab lands on. */
	function jumpTo(section: Section) {
		const el = sectionElement(section.id);
		if (!body || !el) return;
		body.scrollTop = el.offsetTop;
		current = section.id;
		active = section.start;
	}

	/** Marks the group at the top of the list as the current tab. */
	function onscroll() {
		if (!body) return;
		const top = body.scrollTop + 4;
		let next = sections[0]?.id;
		for (const section of sections) {
			const el = sectionElement(section.id);
			if (el && el.offsetTop <= top) next = section.id;
		}
		if (next) current = next;
	}

	function itemAt(index: number): HTMLElement | null {
		return body?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null;
	}

	function focusItem(index: number) {
		const next = Math.max(0, Math.min(count - 1, index));
		active = next;
		itemAt(next)?.focus();
	}

	/** How many emoji fit in a row of the grid `el` sits in. */
	function columns(el: HTMLElement): number {
		const grid = el.parentElement;
		if (!grid) return 1;
		return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
	}

	/** Arrow keys move through the emoji as one grid, Home and End to the ends. */
	function onGridKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const index = Number(target.dataset.index);
		if (Number.isNaN(index)) return;
		const step: Record<string, number> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -columns(target),
			ArrowDown: columns(target),
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

	function itemFrom(event: Event): Item | null {
		const el = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
		if (!el) return null;
		const index = Number(el.dataset.index);
		const section = sections.findLast((s) => s.start <= index);
		return section?.items[index - section.start] ?? null;
	}
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

	<!-- Its handlers serve the emoji buttons inside: arrow keys, and naming the one pointed at. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={body}
		class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
		{onscroll}
		onkeydown={onGridKeydown}
		onpointerover={(event) => (previewed = itemFrom(event))}
		onpointerleave={() => (previewed = null)}
		onfocusin={(event) => (previewed = itemFrom(event))}
		onfocusout={() => (previewed = null)}
	>
		{#if failed !== undefined}
			<FormMessage class="p-2" error={{ message: m.emoji_load_failed(), cause: failed }} />
		{:else if !catalog}
			<Delayed>
				<div class="grid animate-in grid-cols-8 gap-1 pt-2 fade-in" aria-hidden="true">
					{#each { length: 32 }, i (i)}
						<Skeleton class="aspect-square" />
					{/each}
				</div>
			</Delayed>
		{:else if count === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">{m.emoji_empty()}</p>
		{:else}
			{#each sections as section (section.id)}
				<section data-section={section.id} aria-labelledby="emoji-section-{section.id}">
					<h3
						id="emoji-section-{section.id}"
						class={cn(
							'sticky top-0 z-10 bg-popover py-1.5 text-xs font-medium text-muted-foreground',
							section.id === 'results' && 'sr-only'
						)}
					>
						{section.label}
					</h3>
					<div
						class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))]"
					>
						{#each section.items as item, i (item.text)}
							{@const index = section.start + i}
							<button
								type="button"
								data-index={index}
								tabindex={index === active ? 0 : -1}
								aria-label={item.name}
								aria-current={emojiKey(item.text) === valueKey ? 'true' : undefined}
								class="flex aspect-square items-center justify-center rounded-md text-2xl leading-none transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-accent md:text-xl"
								onfocus={() => (active = index)}
								onclick={() => pick(item)}
							>
								{item.text}
							</button>
						{/each}
					</div>
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
