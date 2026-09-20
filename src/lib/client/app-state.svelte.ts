import { createContext } from 'svelte';
import type { ClientApi } from '$lib/db/api';
import type { BudgetMeta } from '$lib/db/repos/meta';
import { formatMoney, formatMoneyCompact, parseAmount, type MoneyFormat } from '$lib/domain/money';
import { isDemoFile } from './demo';
import type { RpcClient } from './rpc';
import type { StartupErrorCode } from './session';

export type BootState =
	| { kind: 'loading' }
	| { kind: 'blocked' }
	| { kind: 'error'; code: StartupErrorCode; message: string }
	| { kind: 'onboarding' }
	| { kind: 'ready' };

/** The open budget: the RPC client, its file, and its meta (kept current by `watchMeta`). */
export class BudgetSession {
	readonly client: RpcClient;
	readonly file: string;
	meta: BudgetMeta;

	constructor(client: RpcClient, file: string, meta: BudgetMeta) {
		this.client = client;
		this.file = file;
		this.meta = $state(meta);
	}

	get api(): ClientApi {
		return this.client.api;
	}

	/** Whether this is the throwaway demo budget rather than one of the user's own. */
	get isDemo(): boolean {
		return isDemoFile(this.file);
	}

	get money(): MoneyFormat {
		return { currency: this.meta.currency, locale: this.meta.locale };
	}

	format = (minor: number): string => formatMoney(minor, this.money);

	/** A short form for chart axes, e.g. "$1.2M". */
	formatCompact = (minor: number): string => formatMoneyCompact(minor, this.money);

	parse = (text: string): number | null => parseAmount(text, this.money);

	/** Re-reads meta whenever a write changes it. Returns the unsubscribe function. */
	watchMeta(): () => void {
		return this.client.onChange((tables) => {
			if (tables.includes('meta')) void this.api.meta.get().then((meta) => (this.meta = meta));
		});
	}
}

export class AppState {
	boot: BootState = $state({ kind: 'loading' });
	session: BudgetSession | null = $state(null);

	/** Shows `file` as the open budget. The app shell remounts, since it is keyed on the file. */
	show(client: RpcClient, file: string, meta: BudgetMeta): void {
		this.session = new BudgetSession(client, file, meta);
		this.boot = { kind: 'ready' };
	}
}

export const [getApp, setApp] = createContext<AppState>();

/** The open budget. Only call it from components that render while the app is ready. */
export function useSession(): BudgetSession {
	const session = getApp().session;
	if (!session) throw new Error('No budget is open');
	return session;
}
