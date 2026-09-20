<script lang="ts">
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { m } from '$lib/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let {
		current,
		total,
		onNext,
		onBack
	}: { current: number; total: number; onNext: () => void; onBack: () => void } = $props();

	const points = [
		{ icon: TriangleAlertIcon, text: m.onboarding_backups_point_only_here() },
		{ icon: FileDownIcon, text: m.onboarding_backups_point_file() },
		{ icon: CloudUploadIcon, text: m.onboarding_backups_point_planned() }
	];
</script>

<StepLayout
	title={m.onboarding_backups_title()}
	description={m.onboarding_backups_body()}
	{current}
	{total}
	nextLabel={m.onboarding_next()}
	backLabel={m.onboarding_back()}
	{onNext}
	{onBack}
>
	<ul class="grid gap-4">
		{#each points as point (point.text)}
			<li class="flex gap-3">
				<point.icon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
				<span class="text-sm text-muted-foreground">{point.text}</span>
			</li>
		{/each}
	</ul>
</StepLayout>
