import { describe, expect, it, vi } from 'vitest';

const { errorMock, successMock } = vi.hoisted(() => ({
	errorMock: vi.fn(),
	successMock: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { error: errorMock, success: successMock } }));

import { DomainError } from '$domain/errors';
import type { RpcClient } from './rpc';
import { offerUndo } from './undo';

interface Button {
	label: string;
	onClick: () => void;
}

function fakeClient(token: string | null, apply = vi.fn(async () => {})) {
	return {
		client: { undoToken: () => token, api: { undo: { apply } } } as unknown as RpcClient,
		apply
	};
}

/** The options of the last success toast. */
function lastOptions(): { action?: Button; cancel?: Button; duration?: number } {
	return successMock.mock.calls.at(-1)?.[1];
}

describe('offerUndo', () => {
	it('shows the message with an Undo button that takes the write back', async () => {
		successMock.mockClear();
		const { client, apply } = fakeClient('7');
		offerUndo(client, Promise.resolve(), 'Deleted');
		expect(successMock).toHaveBeenCalledWith('Deleted', expect.anything());
		lastOptions().action!.onClick();
		await vi.waitFor(() => expect(apply).toHaveBeenCalledWith('7'));
		await vi.waitFor(() => expect(successMock).toHaveBeenCalledTimes(2));
	});

	it('puts Undo second when the toast has its own action', () => {
		successMock.mockClear();
		const { client } = fakeClient('7');
		const reconcile = { label: 'Reconcile', onClick: () => {} };
		offerUndo(client, Promise.resolve(), 'Imported', { action: reconcile });
		expect(lastOptions().action).toBe(reconcile);
		expect(lastOptions().cancel?.label).toBeTruthy();
	});

	it('shows the message alone when the write left nothing to undo', () => {
		successMock.mockClear();
		const { client } = fakeClient(null);
		offerUndo(client, Promise.resolve(), 'Deleted');
		expect(lastOptions().action).toBeUndefined();
	});

	it('reports an undo that could not run', async () => {
		errorMock.mockClear();
		const { client } = fakeClient(
			'7',
			vi.fn(async () => {
				throw new DomainError('UNDO_CONFLICT');
			})
		);
		offerUndo(client, Promise.resolve(), 'Deleted');
		lastOptions().action!.onClick();
		await vi.waitFor(() => expect(errorMock).toHaveBeenCalled());
	});
});
