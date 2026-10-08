<script lang="ts">
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import FormMessage from '$components/FormMessage.svelte';
	import HelpLink from '$components/HelpLink.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { FLAG_COLORS, type FlagColor } from '$domain/flag';
	import { FLAG_NAME_MAX, type FlagRow } from '$db/repos/flags';
	import { m } from '$i18n/paraglide/messages';
	import FlagIcon from './FlagIcon.svelte';
	import { FLAG_COLOR_NAMES } from './flags';

	/**
	 * Renames the six flags, each in a field of its own; an empty one goes back to its color's name.
	 * `ondone` runs after saving, and on Cancel.
	 */
	let { flags, ondone }: { flags: readonly FlagRow[] | undefined; ondone: () => void } = $props();

	const session = useSession();
	// A draft, taken when the screen opens.
	let names = $state(
		Object.fromEntries(
			FLAG_COLORS.map((c) => [c, flags?.find((f) => f.color === c)?.name ?? ''])
		) as Record<FlagColor, string>
	);
	let error = $state<ActionError | null>(null);
	let busy = $state(false);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		error = await runAction(() => session.api.flags.rename(names));
		busy = false;
		if (!error) ondone();
	}
</script>

<form class="grid gap-3" onsubmit={save} data-testid="flag-names">
	<p class="text-sm text-muted-foreground">
		{m.flag_names_body()}
		<HelpLink topic="flags" class="size-5 align-middle" />
	</p>
	{#each FLAG_COLORS as color (color)}
		<div class="flex items-center gap-2">
			<FlagIcon {color} />
			<Input
				bind:value={names[color]}
				placeholder={FLAG_COLOR_NAMES[color]()}
				aria-label={m.flag_name_for({ color: FLAG_COLOR_NAMES[color]() })}
				maxlength={FLAG_NAME_MAX}
				autocomplete="off"
			/>
		</div>
	{/each}
	<FormMessage {error} />
	<div class="grid grid-cols-2 gap-2">
		<Button variant="outline" onclick={ondone}>{m.cancel()}</Button>
		<Button type="submit" disabled={busy}>{m.save()}</Button>
	</div>
</form>
