// Shared with the guide's generator (guide/build.ts), which runs in Node: no aliases, no DOM.

/**
 * The user guide's pages, in reading order. The guide is static HTML under `/guide/`, generated
 * after the app's build and never precached: it is fetched only when someone opens it.
 */
export const GUIDE_PAGES = [
	'index',
	'budgeting',
	'accounts',
	'transactions',
	'schedules',
	'import',
	'payees',
	'reports',
	'situations',
	'settings',
	'data',
	'faq',
	'glossary'
] as const;

export type GuidePage = (typeof GUIDE_PAGES)[number];

/** The languages the guide is written in; the first one lives at `/guide/`. */
export const GUIDE_LOCALES = ['en', 'pt-BR'] as const;

export type GuideLocale = (typeof GUIDE_LOCALES)[number];

/** Sections the app links to from its screens: a page and the heading id on it. */
export const GUIDE_TOPICS = {
	readyToAssign: ['budgeting', 'ready-to-assign'],
	assigning: ['budgeting', 'assigning'],
	overspending: ['budgeting', 'overspending'],
	categories: ['budgeting', 'categories'],
	accountKinds: ['accounts', 'account-kinds'],
	entering: ['transactions', 'entering'],
	flags: ['transactions', 'flags'],
	carryover: ['budgeting', 'carryover'],
	goals: ['budgeting', 'goals'],
	cardBilling: ['accounts', 'card-billing'],
	reconcile: ['accounts', 'reconcile'],
	scheduleSearch: ['schedules', 'search'],
	installmentsUnderWay: ['schedules', 'installments-under-way'],
	importing: ['import', 'matching'],
	payeeRules: ['payees', 'payee-rules'],
	encryption: ['data', 'encryption'],
	backups: ['data', 'backups'],
	googleDrive: ['data', 'google-drive'],
	reports: ['reports', 'list']
} as const satisfies Record<string, readonly [GuidePage, string]>;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

/** The address of a guide page in `locale`, with a trailing slash; English when it isn't one. */
export function guidePath(locale: string, page: GuidePage = 'index', anchor?: string): string {
	const prefix = locale === 'en' || !isGuideLocale(locale) ? '/guide/' : `/guide/${locale}/`;
	const path = page === 'index' ? prefix : `${prefix}${page}/`;
	return anchor ? `${path}#${anchor}` : path;
}

/** The address of one of `GUIDE_TOPICS` in `locale`. */
export function guideTopicPath(locale: string, topic: GuideTopic): string {
	const [page, anchor] = GUIDE_TOPICS[topic];
	return guidePath(locale, page, anchor);
}

function isGuideLocale(locale: string): locale is GuideLocale {
	return (GUIDE_LOCALES as readonly string[]).includes(locale);
}
