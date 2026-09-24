<script lang="ts">
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { getApp, useSession } from '$client/app-state.svelte';
	import { DEMO_FILE, endDemo } from '$client/demo';
	import { runActionToast } from '$client/notify';
	import { Button } from '$ui/button';
	import { m } from '$i18n/paraglide/messages';

	const app = getApp();
	const session = useSession();

	/**
	 * Throws the demo away and starts over. Clearing the session first is what makes `Boot` offer
	 * first-run onboarding with no way back to a budget that no longer exists.
	 */
	function startForReal() {
		void runActionToast(async () => {
			await session.api.system.deleteFile(DEMO_FILE);
			endDemo(localStorage);
			app.session = null;
			app.boot = { kind: 'onboarding' };
		});
	}
</script>

<div
	class="sticky top-0 z-40 shrink-0 border-b bg-red-600/80 pt-[env(safe-area-inset-top)] text-white dark:bg-red-500/60"
	data-scroll-inset="top"
>
	<div class="flex h-16 items-center gap-2 px-3">
		<TriangleAlertIcon class="size-4 shrink-0" aria-hidden="true" />
		<p class="min-w-0 flex-1 text-sm">{m.demo_banner_body()}</p>
		<Button size="sm" variant="secondary" class="h-7 shrink-0" onclick={startForReal}>
			{m.demo_banner_action()}
		</Button>
	</div>
</div>
