<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { m } from '$i18n/paraglide/messages';

	/** A full report's page: the way back to the overview, its title, its period (`toolbar`), then the report. */
	let { title, toolbar, children }: { title: string; toolbar?: Snippet; children: Snippet } =
		$props();
</script>

<PageHeader {title} back={{ route: '/reports', label: m.nav_reports() }} {toolbar} />

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	{@render children()}
</div>
<svelte:head><title>{title} · {m.app_name()}</title></svelte:head>
