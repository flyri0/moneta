<script lang="ts">
	/** A name with its emoji icon before it, when it has one. The icon is left out of its accessible name. */
	let { icon, label }: { icon: string | null | undefined; label: string } = $props();
</script>

{#if icon}<span aria-hidden="true" class="mr-1.5">{icon}</span>{/if}{label}
