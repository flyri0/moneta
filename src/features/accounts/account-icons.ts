import type { Component } from 'svelte';
import BanknoteIcon from '@lucide/svelte/icons/banknote';
import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
import CreditCardIcon from '@lucide/svelte/icons/credit-card';
import LandmarkIcon from '@lucide/svelte/icons/landmark';
import PiggyBankIcon from '@lucide/svelte/icons/piggy-bank';
import ReceiptIcon from '@lucide/svelte/icons/receipt';
import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
import type { AccountType } from '$db/repos/accounts';

export const ACCOUNT_TYPE_ICONS: Record<AccountType, Component> = {
	checking: LandmarkIcon,
	savings: PiggyBankIcon,
	cash: BanknoteIcon,
	credit_card: CreditCardIcon,
	investment: TrendingUpIcon,
	loan: ReceiptIcon,
	other: CircleEllipsisIcon
};

export function accountTypeIcon(type: AccountType): Component {
	return ACCOUNT_TYPE_ICONS[type];
}
