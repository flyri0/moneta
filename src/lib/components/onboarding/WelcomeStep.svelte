<script lang="ts">
	import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
	import MonitorSmartphoneIcon from '@lucide/svelte/icons/monitor-smartphone';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import CustomizationGroup from '$lib/components/settings/CustomizationGroup.svelte';
	import { m } from '$lib/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let { current, total, onNext }: { current: number; total: number; onNext: () => void } = $props();

	const points = [
		{ icon: MonitorSmartphoneIcon, text: m.onboarding_welcome_point_browser() },
		{ icon: ShieldCheckIcon, text: m.onboarding_welcome_point_private() },
		{ icon: HardDriveIcon, text: m.onboarding_welcome_point_device() }
	];
</script>

<StepLayout
	title={m.onboarding_title()}
	description={m.onboarding_welcome_body()}
	{current}
	{total}
	nextLabel={m.onboarding_next()}
	{onNext}
>
	<ul class="grid gap-3">
		{#each points as point (point.text)}
			<li class="flex gap-3">
				<point.icon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
				<span class="text-sm text-muted-foreground">{point.text}</span>
			</li>
		{/each}
	</ul>

	<CustomizationGroup />
</StepLayout>
