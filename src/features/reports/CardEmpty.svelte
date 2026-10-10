<script lang="ts">
	import type { Component } from 'svelte';
	import EmptyState from '$components/EmptyState.svelte';

	/** A report card with nothing to show yet: an icon and why, centered in the card. */
	let { icon, description }: { icon: Component; description: string } = $props();
</script>

<EmptyState {icon} {description} class="flex-1 content-center py-0" />
