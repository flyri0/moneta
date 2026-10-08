import { describe, it, expect } from 'vitest';
import type { ScheduleRow } from '$db/repos/schedules';
import {
	activeScheduleFilterCount,
	filterSchedules,
	NO_SCHEDULE_FILTERS,
	type ScheduleFilterValues
} from './filters';

const money = { currency: 'USD', locale: 'en-US' };

const row = (id: string, over: Partial<ScheduleRow> = {}): ScheduleRow => ({
	id,
	accountId: 'bank',
	accountName: 'Bank',
	amount: -150000,
	payeeId: 'landlord',
	payeeName: 'Landlord',
	categoryId: 'rent',
	categoryName: 'Rent',
	transferAccountId: null,
	transferAccountName: null,
	memo: '',
	flag: null,
	isSplit: false,
	splits: [],
	autoEnter: false,
	startDate: '2026-10-05',
	frequency: 'monthly',
	interval: 1,
	endDate: null,
	endCount: null,
	weekend: 'keep',
	nextIndex: 0,
	installmentStart: null,
	nextDate: '2026-10-05',
	status: 'active',
	...over
});

const rows: ScheduleRow[] = [
	row('rent'),
	row('tv', {
		accountId: 'card',
		accountName: 'Card',
		amount: -8000,
		payeeId: 'store',
		payeeName: 'Açougue Store',
		categoryId: 'fun',
		categoryName: 'Fun',
		memo: 'TV',
		autoEnter: true,
		installmentStart: 4,
		endCount: 9,
		nextDate: '2026-11-10'
	}),
	row('save', {
		amount: -30000,
		payeeId: null,
		payeeName: null,
		categoryId: null,
		categoryName: null,
		transferAccountId: 'savings',
		transferAccountName: 'Savings',
		status: 'due',
		nextDate: '2026-09-30'
	}),
	row('groceries', {
		amount: -20000,
		payeeId: 'market',
		payeeName: 'Market',
		categoryId: null,
		categoryName: null,
		isSplit: true,
		splits: [
			{ id: 'a', categoryId: 'food', categoryName: 'Food', amount: -12500, memo: 'weekly' },
			{ id: 'b', categoryId: 'home', categoryName: 'Home', amount: -7500, memo: '' }
		]
	}),
	row('old', {
		amount: -5000,
		payeeId: 'gym',
		payeeName: 'Gym',
		categoryId: 'fitness',
		categoryName: 'Fitness',
		status: 'ended',
		nextDate: null
	})
];

const ids = (search: string, over: Partial<ScheduleFilterValues> = {}) =>
	filterSchedules(rows, search, { ...NO_SCHEDULE_FILTERS, ...over }, money).map((s) => s.id);

describe('filterSchedules', () => {
	it('keeps everything, in order, with no search or filter', () => {
		expect(ids('')).toEqual(['rent', 'tv', 'save', 'groceries', 'old']);
	});

	it('searches names, categories and memos, ignoring case and accents', () => {
		expect(ids('acougue')).toEqual(['tv']);
		expect(ids('SAVINGS')).toEqual(['save']);
		expect(ids('card')).toEqual(['tv']);
		expect(ids('food')).toEqual(['groceries']);
		expect(ids('weekly')).toEqual(['groceries']);
		expect(ids('tv')).toEqual(['tv']);
	});

	it('needs every word to match', () => {
		expect(ids('bank rent')).toEqual(['rent']);
		expect(ids('bank nothing')).toEqual([]);
	});

	it('matches an amount of either sign, a split line’s too', () => {
		expect(ids('80')).toEqual(['tv']);
		expect(ids('-1,500.00')).toEqual(['rent']);
		expect(ids('125')).toEqual(['groceries']);
	});

	it('keeps the next dates in the period, leaving ended ones out', () => {
		expect(ids('', { from: '2026-10-01' })).toEqual(['rent', 'tv', 'groceries']);
		expect(ids('', { to: '2026-10-05' })).toEqual(['rent', 'save', 'groceries']);
	});

	it('filters by account, either side of a transfer', () => {
		expect(ids('', { accountId: 'savings' })).toEqual(['save']);
		expect(ids('', { accountId: 'card' })).toEqual(['tv']);
	});

	it('filters by category, a split line’s too, and by payee', () => {
		expect(ids('', { categoryId: 'home' })).toEqual(['groceries']);
		expect(ids('', { categoryId: 'rent' })).toEqual(['rent']);
		expect(ids('', { payeeId: 'store' })).toEqual(['tv']);
	});

	it('filters by the size of the amount', () => {
		expect(ids('', { amountMin: 20000, amountMax: 30000 })).toEqual(['save', 'groceries']);
		expect(ids('', { amountMax: 8000 })).toEqual(['tv', 'old']);
	});

	it('filters by status and by type', () => {
		expect(ids('', { status: 'due' })).toEqual(['save']);
		expect(ids('', { status: 'upcoming' })).toEqual(['rent', 'tv', 'groceries']);
		expect(ids('', { status: 'inactive' })).toEqual(['old']);
		expect(ids('', { kind: 'auto' })).toEqual(['tv']);
		expect(ids('', { kind: 'manual' })).toEqual(['rent', 'save', 'groceries', 'old']);
		expect(ids('', { kind: 'installments' })).toEqual(['tv']);
	});

	it('combines the search and the filters', () => {
		expect(ids('bank', { status: 'due' })).toEqual(['save']);
	});
});

describe('activeScheduleFilterCount', () => {
	it('counts the period and the amount once each', () => {
		expect(activeScheduleFilterCount(NO_SCHEDULE_FILTERS)).toBe(0);
		expect(
			activeScheduleFilterCount({
				...NO_SCHEDULE_FILTERS,
				from: '2026-01-01',
				to: '2026-12-31',
				amountMin: 1,
				amountMax: 2,
				kind: 'auto',
				accountId: 'bank'
			})
		).toBe(4);
	});
});
