<script lang="ts">
	import { ACCOUNT_CATEGORIES } from '$features/accounts/account-form';
	import { accountTypeIcon } from '$features/accounts/account-icons';
	import type { AccountType } from '$db/repos/accounts';
	import { accountTypeDescription, accountTypeLabel } from '$i18n/labels';
	import { m } from '$i18n/paraglide/messages';

	let {
		selected,
		onSelect
	}: {
		selected?: AccountType;
		onSelect: (type: AccountType) => void;
	} = $props();

	function categoryTitle(key: string): string {
		return key === 'budget' ? m.accounts_on_budget() : m.accounts_off_budget();
	}

	function categoryDescription(key: string): string {
		return key === 'budget'
			? m.account_category_budget_description()
			: m.account_category_tracking_description();
	}
</script>

<div class="grid gap-5">
	<p class="text-sm text-muted-foreground">{m.account_creation_type_prompt()}</p>
	{#each ACCOUNT_CATEGORIES as category (category.key)}
		<section class="grid gap-2" aria-labelledby="heading-{category.key}">
			<div>
				<h3
					id="heading-{category.key}"
					class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
				>
					{categoryTitle(category.key)}
				</h3>
				<p class="text-xs text-muted-foreground">
					{categoryDescription(category.key)}
				</p>
			</div>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each category.types as type (type)}
					{@const Icon = accountTypeIcon(type)}
					<button
						type="button"
						class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {selected ===
						type
							? 'border-primary bg-muted/40 ring-1 ring-primary'
							: 'border-border'}"
						onclick={() => onSelect(type)}
					>
						<div
							class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
						>
							<Icon class="size-4" />
						</div>
						<div class="grid gap-0.5">
							<span class="text-sm leading-none font-medium">{accountTypeLabel(type)}</span>
							<span class="text-xs leading-snug text-muted-foreground">
								{accountTypeDescription(type)}
							</span>
						</div>
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>
