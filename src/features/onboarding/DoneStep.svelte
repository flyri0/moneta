<script lang="ts">
	import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';
	import { m } from '$i18n/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let { current, total, onNext }: { current: number; total: number; onNext: () => void } = $props();
</script>

<StepLayout
	title={m.onboarding_done_title()}
	description={m.onboarding_done_body()}
	{current}
	{total}
	nextLabel={m.onboarding_done_start()}
	{onNext}
>
	<div class="flex gap-3 rounded-lg border bg-muted/40 p-4">
		<CircleCheckBigIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
		<p class="text-sm text-muted-foreground">{m.onboarding_done_backup_hint()}</p>
	</div>
</StepLayout>
