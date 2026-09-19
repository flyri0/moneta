import { describe, it, expect } from 'vitest';
import { RpcError } from '$lib/client/rpc';
import { DomainError, ERROR_CODES } from '$lib/domain/errors';
import { m } from '$lib/paraglide/messages';
import { errorDetails, errorMessage, isUnexpected } from './errors';

describe('errorMessage', () => {
	it('translates every error code', () => {
		for (const code of ERROR_CODES) {
			const text = errorMessage(new RpcError(code, 'raw'));
			expect(text, code).not.toBe('raw');
			expect(text, code).not.toBe(code);
		}
	});

	it('works for domain errors and falls back for anything else', () => {
		expect(errorMessage(new DomainError('SPLIT_SUM_MISMATCH'))).toBe(m.error_split_sum_mismatch());
		expect(errorMessage(new RpcError('NOPE', 'x'))).toBe(m.error_internal());
		expect(errorMessage(new TypeError('boom'))).toBe(m.error_internal());
		expect(errorMessage(null)).toBe(m.error_internal());
	});
});

describe('isUnexpected', () => {
	it('separates user-fixable errors from bugs', () => {
		expect(isUnexpected(new RpcError('ACCOUNT_BALANCE_NOT_ZERO', 'x'))).toBe(false);
		expect(isUnexpected(new RpcError('INTERNAL', 'x'))).toBe(true);
		expect(isUnexpected(new RpcError('WORKER_FAILED', 'x'))).toBe(true);
		expect(isUnexpected(new Error('boom'))).toBe(true);
	});
});

describe('errorDetails', () => {
	it('includes the code, message and details', () => {
		const text = errorDetails(new RpcError('SPLIT_SUM_MISMATCH', 'Mismatch', { expected: 1 }));
		expect(JSON.parse(text)).toMatchObject({
			code: 'SPLIT_SUM_MISMATCH',
			message: 'Mismatch',
			details: { expected: 1 }
		});
		expect(errorDetails('plain')).toBe('plain');
	});
});
