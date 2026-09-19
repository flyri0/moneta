export const ERROR_CODES = [
	'INVALID_INPUT',
	'NOT_FOUND',
	'ALREADY_INITIALIZED',
	'SCHEMA_TOO_NEW',
	'NO_DATABASE_OPEN',
	'UNKNOWN_METHOD',
	'STORAGE_UNAVAILABLE',
	'ACCOUNT_CLOSED',
	'ACCOUNT_HAS_TRANSACTIONS',
	'ACCOUNT_BALANCE_NOT_ZERO',
	'CC_PAYMENT_NOT_EMPTY',
	'CATEGORY_REQUIRED',
	'CATEGORY_NOT_ALLOWED',
	'SYSTEM_ENTITY_READONLY',
	'GROUP_NOT_EMPTY',
	'REASSIGN_REQUIRED',
	'SPLIT_TOO_FEW_LINES',
	'SPLIT_SUM_MISMATCH',
	'TRANSFER_INVALID',
	'BACKUP_NOT_SQLITE',
	'BACKUP_DAMAGED',
	'BACKUP_NOT_MONETA',
	'CURRENCY_LOCKED',
	'WORKER_FAILED',
	'INTERNAL'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
	constructor(
		public readonly code: ErrorCode,
		message: string = code,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'DomainError';
	}
}
