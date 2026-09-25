<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$ui/button';
	import { Input } from '$ui/input';
	import { Combobox } from '$ui/combobox';
	import FormMessage from '$components/FormMessage.svelte';
	import SettingsGroup from './SettingsGroup.svelte';
	import SettingsRow from './SettingsRow.svelte';
	import { useSession } from '$client/app-state.svelte';
	import { runAction, type ActionError } from '$client/notify';
	import { updateBudget } from '$client/session';
	import { currencyChoices, localeChoices } from '$i18n/formats';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';

	const session = useSession();
	const locales = localeChoices(getLocale(), session.meta.locale);
	const currencies = currencyChoices(getLocale());

	let name = $state(session.meta.name);
	let locale = $state(session.meta.locale);
	let currency = $state(session.meta.currency);
	let error = $state<ActionError | null>(null);
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

<form onsubmit={save}>
	<SettingsGroup title={m.settings_budget_details()}>
		<SettingsRow stacked label={m.onboarding_budget_name()} labelFor="details-name">
			{#snippet control()}
				<Input id="details-name" bind:value={name} required autocomplete="off" />
			{/snippet}
		</SettingsRow>

		<SettingsRow stacked label={m.onboarding_locale()} labelFor="details-locale">
			{#snippet control()}
				<Combobox
					id="details-locale"
					items={locales}
					bind:value={locale}
					placeholder={m.onboarding_locale()}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow stacked label={m.onboarding_currency()} labelFor="details-currency">
			{#snippet control()}
				<Combobox
					id="details-currency"
					items={currencies}
					bind:value={currency}
					placeholder={m.onboarding_currency()}
				/>
			{/snippet}
		</SettingsRow>

		<div class="grid gap-2 px-4 py-3">
			<FormMessage {error} />
			<Button type="submit" class="justify-self-start" disabled={busy}>{m.save()}</Button>
		</div>
	</SettingsGroup>
</form>
