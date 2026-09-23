import type { ErrorCode } from '$domain/errors';
import { m } from '$i18n/paraglide/messages';

/** Every error code the worker or the client can report, in the UI language. */
const MESSAGES: Record<ErrorCode, () => string> = {
	INVALID_INPUT: m.error_invalid_input,
	NOT_FOUND: m.error_not_found,
	ALREADY_INITIALIZED: m.error_already_initialized,
	SCHEMA_TOO_NEW: m.error_schema_too_new,
	NO_DATABASE_OPEN: m.error_no_database_open,
	UNKNOWN_METHOD: m.error_internal,
	STORAGE_UNAVAILABLE: m.error_storage_unavailable,
	ACCOUNT_CLOSED: m.error_account_closed,
	ACCOUNT_HAS_TRANSACTIONS: m.error_account_has_transactions,
	ACCOUNT_BALANCE_NOT_ZERO: m.error_account_balance_not_zero,
	CATEGORY_REQUIRED: m.error_category_required,
	CATEGORY_NOT_ALLOWED: m.error_category_not_allowed,
	SYSTEM_ENTITY_READONLY: m.error_system_entity_readonly,
	GROUP_NOT_EMPTY: m.error_group_not_empty,
	REASSIGN_REQUIRED: m.error_reassign_required,
	SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
	SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch,
	TRANSFER_INVALID: m.error_transfer_invalid,
	BACKUP_NOT_RECOGNIZED: m.error_backup_not_recognized,
	BACKUP_DAMAGED: m.error_backup_damaged,
	BACKUP_NOT_MONETA: m.error_backup_not_moneta,
	BACKUP_TOO_NEW: m.error_backup_too_new,
	BACKUP_ENCRYPTED: m.error_backup_encrypted,
	BACKUP_WRONG_KEY: m.error_backup_wrong_key,
	CURRENCY_LOCKED: m.error_currency_locked,
	WORKER_FAILED: m.error_worker_failed,
	INTERNAL: m.error_internal
};

/** Codes that point at a bug or a broken worker rather than at something the user can fix. */
const UNEXPECTED = new Set<string>([
	'INTERNAL',
	'UNKNOWN_METHOD',
	'NO_DATABASE_OPEN',
	'WORKER_FAILED'
]);

function codeOf(err: unknown): string | undefined {
	const code = (err as { code?: unknown } | null)?.code;
	return typeof code === 'string' ? code : undefined;
}

function isKnown(code: string | undefined): code is ErrorCode {
	return code !== undefined && Object.hasOwn(MESSAGES, code);
}

/** A translated message for any thrown value (RpcError, DomainError or anything else). */
export function errorMessage(err: unknown): string {
	const code = codeOf(err);
	return isKnown(code) ? MESSAGES[code]() : m.error_internal();
}

export function isUnexpected(err: unknown): boolean {
	const code = codeOf(err);
	return !isKnown(code) || UNEXPECTED.has(code);
}

/** Everything useful for a bug report, for the "copy details" action. */
export function errorDetails(err: unknown): string {
	if (!(err instanceof Error)) return String(err);
	const { details } = err as { details?: unknown };
	return JSON.stringify(
		{ name: err.name, code: codeOf(err), message: err.message, details, stack: err.stack },
		null,
		2
	);
}
