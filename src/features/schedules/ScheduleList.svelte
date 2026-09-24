<script lang="ts">
	import { Badge } from '$ui/badge';
	import { payeeDisplay, payeeText } from '$features/accounts/register';
	import { useSession } from '$client/app-state.svelte';
	import type { ScheduleRow } from '$db/repos/schedules';
	import { formatDate } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { ruleSummary } from './form';

	/** Schedules in sections (due, upcoming, then paused or ended). A row opens `onOpen`. */
	let { schedules, onOpen }: { schedules: ScheduleRow[]; onOpen: (schedule: ScheduleRow) => void } =
		$props();

	const session = useSession();
	const sections = $derived(
		[
			{ title: m.schedules_due(), rows: schedules.filter((s) => s.status === 'due') },
			{ title: m.schedules_upcoming(), rows: schedules.filter((s) => s.status === 'active') },
			{
				title: m.schedules_inactive(),
				rows: schedules.filter((s) => s.status === 'paused' || s.status === 'ended')
			}
		].filter((section) => section.rows.length > 0)
	);

	function detail(s: ScheduleRow): string {
		const when =
			s.status === 'paused'
				? m.schedules_paused()
				: s.nextDate === null
					? m.schedules_ended()
					: m.schedules_next({ date: formatDate(s.nextDate, getLocale()) });
		return `${s.accountName} · ${ruleSummary(s)} · ${when}`;
	}
</script>

{#each sections as section (section.title)}
	<section class="grid gap-2" aria-label={section.title}>
		<h2 class="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
			{section.title}
		</h2>
		<ul class="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs">
			{#each section.rows as s (s.id)}
				<li>
					<button
						type="button"
						class="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/40"
						data-testid="schedule-row"
						onclick={() => onOpen(s)}
					>
						<span class="flex min-w-0 items-center gap-2">
							<span class="truncate text-sm font-medium">{payeeText(payeeDisplay(s))}</span>
							{#if s.autoEnter}<Badge variant="secondary">{m.schedules_auto()}</Badge>{/if}
						</span>
						<span
							class="text-right text-sm font-semibold tabular-nums {s.amount < 0
								? ''
								: 'text-emerald-700 dark:text-emerald-400'}"
						>
							{session.format(s.amount)}
						</span>
						<span class="col-span-2 truncate text-xs text-muted-foreground">{detail(s)}</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/each}
