<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { useSession } from '$lib/client/app-state.svelte';
	import { runAction } from '$lib/client/notify';
	import { updateBudget } from '$lib/client/session';
	import { currencyChoices, localeChoices } from '$lib/i18n/formats';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const session = useSession();
	const locales = localeChoices(getLocale(), session.meta.locale);
	const currencies = currencyChoices(getLocale());

	let name = $state(session.meta.name);
	let locale = $state(session.meta.locale);
	let currency = $state(session.meta.currency);
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = await runAction(() =>
			updateBudget(session.api, localStorage, session.file, { name, locale, currency })
		);
		busy = false;
		if (!error) toast.success(m.settings_saved());
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{m.settings_budget_details()}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form class="grid gap-4" onsubmit={save}>
			<div class="grid gap-2">
				<Label for="details-name">{m.onboarding_budget_name()}</Label>
				<Input id="details-name" bind:value={name} required autocomplete="off" />
			</div>
			<div class="grid gap-2">
				<Label for="details-locale">{m.onboarding_locale()}</Label>
				<NativeSelect id="details-locale" class="w-full" bind:value={locale}>
					{#each locales as choice (choice.value)}
						<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			<div class="grid gap-2">
				<Label for="details-currency">{m.onboarding_currency()}</Label>
				<NativeSelect id="details-currency" class="w-full" bind:value={currency}>
					{#each currencies as choice (choice.value)}
						<NativeSelectOption value={choice.value}>{choice.label}</NativeSelectOption>
					{/each}
				</NativeSelect>
			</div>
			{#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}
			<Button type="submit" class="justify-self-start" disabled={busy}>{m.save()}</Button>
		</form>
	</Card.Content>
</Card.Root>
