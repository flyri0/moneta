<!-- Where a cloud sign-in popup lands. Shown outside the app (see +layout.svelte): no database. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { callbackMessage, OAUTH_CHANNEL } from '$features/backup/cloud/oauth';
	import { m } from '$i18n/paraglide/messages';

	onMount(() => {
		const message = callbackMessage(location.search);
		if (message) {
			// The opener listens on this channel: the provider's pages cut the popup off from it.
			const channel = new BroadcastChannel(OAUTH_CHANNEL);
			channel.postMessage(message);
			channel.close();
		}
		// When the browser won't let the page close itself, the page says to close it. The code in
		// the address is spent, and useless without the verifier, which never left the opener.
		window.close();
	});
</script>

<svelte:head><title>{m.cloud_callback_title()} · {m.app_name()}</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<p class="text-2xl font-semibold">{m.app_name()}</p>
		<h1 class="text-lg font-medium">{m.cloud_callback_title()}</h1>
		<p class="text-muted-foreground">{m.cloud_callback_body()}</p>
	</div>
</main>
