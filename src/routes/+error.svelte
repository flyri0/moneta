<!-- Shown outside the app (see +layout.svelte): an unknown address opens no database. -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '$ui/button';
	import { m } from '$i18n/paraglide/messages';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? m.not_found_title() : m.error_page_title());
</script>

<svelte:head><title>{title} · {m.app_name()}</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<p class="text-2xl font-semibold">{m.app_name()}</p>
		<h1 class="text-lg font-medium">{title}</h1>
		<p class="text-muted-foreground">{notFound ? m.not_found_body() : m.error_page_body()}</p>
		<Button href={resolve('/')}>{m.not_found_home()}</Button>
	</div>
</main>
