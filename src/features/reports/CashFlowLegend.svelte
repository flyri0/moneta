<script lang="ts">
	import { m } from '$i18n/paraglide/messages';

	/** Which colour is income and which is expenses, for every cash flow chart. */
</script>

<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
	<span class="flex items-center gap-1.5">
		<span class="size-2.5 rounded-full bg-income" aria-hidden="true"></span>{m.reports_income()}
	</span>
	<span class="flex items-center gap-1.5">
		<span class="size-2.5 rounded-full bg-spending" aria-hidden="true"></span>{m.reports_expenses()}
	</span>
</div>
