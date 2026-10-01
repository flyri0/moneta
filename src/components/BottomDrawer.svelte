<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$ui/button';
	import * as Sheet from '$ui/sheet';
	import { drawerRelease } from '$client/drawer';
	import { m } from '$i18n/paraglide/messages';

	/**
	 * A sheet that rises from the bottom of a phone's screen. Its top (the grab bar and `header`)
	 * drags: down closes it, up fills the screen when there's more than fits, and a short drag
	 * springs back. The body scrolls on its own, so scrolling or filling it in never moves the
	 * drawer. Escape and tapping outside close it too.
	 */
	let {
		open = $bindable(false),
		ref = $bindable(null),
		onOpenAutoFocus,
		header,
		children
	}: {
		open: boolean;
		/** The drawer itself. */
		ref?: HTMLElement | null;
		onOpenAutoFocus?: (event: Event) => void;
		header: Snippet;
		children: Snippet;
	} = $props();

	const SETTLE_MS = 200;
	const FOCUSABLE =
		'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

	let top = $state<HTMLElement | null>(null);
	let body = $state<HTMLElement | null>(null);
	let expanded = $state(false);
	/** Its height before it filled the screen, to go back to. */
	let natural = 0;

	let drag: {
		pointer: number;
		startY: number;
		height: number;
		expandable: boolean;
		offset: number;
		lastY: number;
		lastAt: number;
		velocity: number;
	} | null = null;

	// It opens at its own height every time.
	$effect(() => {
		if (!open) expanded = false;
	});

	/**
	 * Focuses what the opener asks for, else the first field or button, else the drawer itself;
	 * never the hidden Close, which a dialog still loading would otherwise land on and show.
	 */
	function openAutoFocus(event: Event) {
		onOpenAutoFocus?.(event);
		if (event.defaultPrevented) return;
		event.preventDefault();
		const first = [top, body]
			.map((part) => part?.querySelector<HTMLElement>(FOCUSABLE))
			.find((element) => element);
		(first ?? ref)?.focus({ preventScroll: true });
	}

	function start(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (event.button !== 0 || !ref || !body) return;
		// The back button is in the header, and a tap on it must stay a tap.
		if ((event.target as Element).closest('button, a, input, select, textarea')) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drag = {
			pointer: event.pointerId,
			startY: event.clientY,
			height: ref.offsetHeight,
			expandable: body.scrollHeight > body.clientHeight + 1,
			offset: 0,
			lastY: event.clientY,
			lastAt: event.timeStamp,
			velocity: 0
		};
		ref.style.transition = 'none';
	}

	function move(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointer || !ref) return;
		const elapsed = event.timeStamp - drag.lastAt;
		if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
		drag.lastY = event.clientY;
		drag.lastAt = event.timeStamp;
		drag.offset = event.clientY - drag.startY;
		if (drag.offset >= 0) {
			ref.style.height = '';
			ref.style.transform = `translateY(${drag.offset}px)`;
		} else if (drag.expandable && !expanded) {
			// Anchored at the bottom, it grows under the finger.
			ref.style.transform = '';
			ref.style.maxHeight = 'none';
			ref.style.height = `${Math.min(innerHeight, drag.height - drag.offset)}px`;
		}
	}

	function end(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointer || !ref) return;
		const { offset, height, expandable, lastAt } = drag;
		// A finger that rested before letting go isn't flicking.
		const velocity = event.timeStamp - lastAt > 100 ? 0 : drag.velocity;
		drag = null;
		const drawer = ref;
		const release =
			event.type === 'pointerup'
				? drawerRelease({ offset, velocity, height, expanded, expandable })
				: 'stay';
		drawer.style.transition = `transform ${SETTLE_MS}ms ease-out, height ${SETTLE_MS}ms ease-out`;
		drawer.style.transform = '';

		if (release === 'close') {
			// It leaves from where it was let go, so its own exit animation is skipped.
			drawer.dataset.dragged = '';
			drawer.style.transform = 'translateY(100%)';
			setTimeout(() => (open = false), SETTLE_MS);
			return;
		}
		if (release === 'expand') {
			natural = height;
			drawer.style.height = '100dvh';
		} else if (release === 'collapse') {
			drawer.style.height = `${natural}px`;
		} else if (drawer.style.height) {
			drawer.style.height = `${height}px`;
		}
		setTimeout(() => {
			if (release === 'expand') expanded = true;
			if (release === 'collapse') expanded = false;
			drawer.style.height = '';
			drawer.style.maxHeight = '';
			drawer.style.transition = '';
		}, SETTLE_MS);
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		bind:ref
		side="bottom"
		showCloseButton={false}
		data-expanded={expanded ? '' : undefined}
		class="max-h-[90dvh] gap-0 rounded-t-2xl outline-none data-expanded:h-dvh data-expanded:max-h-dvh data-expanded:rounded-none data-expanded:pt-[env(safe-area-inset-top)] data-dragged:data-closed:animate-none"
		onOpenAutoFocus={openAutoFocus}
	>
		<!-- Dragging is a pointer shortcut: keyboards and screen readers have Escape and Close. -->
		<div
			bind:this={top}
			role="presentation"
			class="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
			onpointerdown={start}
			onpointermove={move}
			onpointerup={end}
			onpointercancel={end}
		>
			<div
				data-slot="drawer-handle"
				class="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/30"
				aria-hidden="true"
			></div>
			{@render header()}
		</div>
		<div
			bind:this={body}
			class="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
		>
			{@render children()}
		</div>
		<!-- Swiping is the way out on a phone; this one is for screen readers and keyboards. -->
		<div
			class="sr-only has-[:focus-visible]:not-sr-only has-[:focus-visible]:absolute has-[:focus-visible]:top-3 has-[:focus-visible]:right-3"
		>
			<Sheet.Close>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>{m.close()}</Button>
				{/snippet}
			</Sheet.Close>
		</div>
	</Sheet.Content>
</Sheet.Root>
