import type { ReadStatement } from './read';

/** A statement file read on an account's page, waiting for the import page to review it. */
export type PendingImport = ReadStatement & { accountId: string; fileName: string };

/** A statement balance to reconcile an account against, after importing. */
export interface PendingReconcile {
	accountId: string;
	balance: number;
	date: string;
}

/** Hands a read statement to the import page, and a statement balance back to the account. */
class ImportHandoff {
	statement = $state.raw<PendingImport | null>(null);
	reconcile = $state.raw<PendingReconcile | null>(null);

	/** The statement waiting for `accountId`, handed over once. */
	takeStatement(accountId: string): PendingImport | null {
		const pending = this.statement?.accountId === accountId ? this.statement : null;
		this.statement = null;
		return pending;
	}
}

export const importHandoff = new ImportHandoff();
