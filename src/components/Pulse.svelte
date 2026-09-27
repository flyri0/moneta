<script lang="ts">
	import type { Snippet } from 'svelte';
	import { motionDuration } from '$client/motion.svelte';

	/**
	 * Gives its content a short pulse when `value` changes, to show a number that just moved. Not
	 * on the first render, nor when `scope` changes with it (another month shows another number).
	 */
	let {
		value,
		scope,
		class: className = '',
		children
	}: { value: unknown; scope?: unknown; class?: string; children: Snippet } = $props();

	let el = $state<HTMLElement>();
	let last: { value: unknown; scope: unknown } | null = null;

	$effect(() => {
		const next = { value, scope };
		const prev = last;
		last = next;
		if (!el || !prev || prev.scope !== next.scope || prev.value === next.value) return;
		const duration = motionDuration(300);
		if (duration === 0) return;
		el.animate(
			[{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
			{ duration, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
		);
	});
</script>

<span bind:this={el} class="inline-block {className}">{@render children()}</span>
