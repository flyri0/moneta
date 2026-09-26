import type { Component } from 'svelte';
import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
import type { AvailableTone, RtaTone } from '$features/budget/view';

/** The Available pill's tint, per tone. */
export const TONE_PILL: Record<AvailableTone, string> = {
	positive: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
	zero: 'bg-muted text-muted-foreground',
	carryover: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
	overspent: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
};

/** The spending bar's fill, per tone, so a card agrees with its pill. */
export const TONE_BAR: Record<AvailableTone, string> = {
	positive: 'bg-emerald-500 dark:bg-emerald-400',
	zero: 'bg-muted-foreground',
	carryover: 'bg-amber-500 dark:bg-amber-400',
	overspent: 'bg-red-500 dark:bg-red-400'
};

/** The Ready to Assign card's tint: green once every unit has a job, amber or red until then. */
export const RTA_CARD: Record<RtaTone, string> = {
	assigned:
		'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
	unassigned:
		'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
	overassigned:
		'border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50'
};

/** The card's amount, icon and hint, per tone. */
export const RTA_TEXT: Record<RtaTone, string> = {
	assigned: 'text-emerald-700 dark:text-emerald-300',
	unassigned: 'text-amber-700 dark:text-amber-300',
	overassigned: 'text-red-700 dark:text-red-300'
};

/** The header chip that stands in for the card once it scrolls away. */
export const RTA_CHIP: Record<RtaTone, string> = {
	assigned: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
	unassigned: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
	overassigned: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
};

export const RTA_ICON: Record<RtaTone, Component> = {
	assigned: CircleCheckIcon,
	unassigned: CircleAlertIcon,
	overassigned: TriangleAlertIcon
};
