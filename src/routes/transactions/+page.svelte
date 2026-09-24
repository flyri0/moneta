<script lang="ts">
	import Register from '$features/accounts/Register.svelte';
	import { m } from '$i18n/paraglide/messages';
</script>

<div class="mx-auto grid max-w-2xl gap-4 p-3 md:p-6 lg:max-w-5xl">
	<header>
		<h1 class="text-xl font-semibold">{m.nav_transactions()}</h1>
	</header>

	<Register />
</div>
<svelte:head><title>{m.nav_transactions()} · {m.app_name()}</title></svelte:head>
