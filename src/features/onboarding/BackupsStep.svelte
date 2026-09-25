<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { BACKUP_ACCEPT } from '$features/backup/target';
	import type { ActionError } from '$client/notify';
	import { m } from '$i18n/paraglide/messages';
	import StepLayout from './StepLayout.svelte';

	let {
		current,
		total,
		busy = false,
		error = null,
		onNext,
		onBack,
		onRestore
	}: {
		current: number;
		total: number;
		busy?: boolean;
		error?: ActionError | null;
		onNext: () => void;
		onBack: () => void;
		onRestore?: (file: File) => void;
	} = $props();

	const points = [
		{ icon: TriangleAlertIcon, text: m.onboarding_backups_point_only_here() },
		{ icon: FileDownIcon, text: m.onboarding_backups_point_file() },
		{ icon: CloudUploadIcon, text: m.onboarding_backups_point_planned() }
	];

	let fileInput: HTMLInputElement | null = $state(null);

	function onFileChange(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file && onRestore) onRestore(file);
	}
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
	{busy}
	{error}
>
	<ul class="grid gap-4">
		{#each points as point (point.text)}
			<li class="flex gap-3">
				<point.icon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
				<span class="text-sm text-muted-foreground">{point.text}</span>
			</li>
		{/each}
	</ul>

	{#if onRestore}
		<section class="grid gap-1.5">
			<h2 class="px-1 text-xs font-medium text-muted-foreground">
				{m.onboarding_restore_title()}
			</h2>
			<div class="overflow-hidden rounded-xl border bg-card text-card-foreground">
				<button
					type="button"
					disabled={busy}
					onclick={() => fileInput?.click()}
					class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
				>
					<FileUpIcon class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
					<div class="grid min-w-0 flex-1 gap-0.5">
						<span class="text-sm font-medium">{m.backup_restore()}</span>
						<span class="text-xs text-muted-foreground">{m.onboarding_restore_hint()}</span>
					</div>
					<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				</button>
			</div>
		</section>
		<label for="restore-file" class="sr-only">{m.backup_restore()}</label>
		<input
			id="restore-file"
			bind:this={fileInput}
			type="file"
			class="sr-only"
			accept={BACKUP_ACCEPT}
			onchange={onFileChange}
		/>
	{/if}
</StepLayout>
