import { describe, expect, it, vi } from 'vitest';

const { dismissMock, errorMock, successMock } = vi.hoisted(() => ({
	dismissMock: vi.fn(),
	errorMock: vi.fn(),
	successMock: vi.fn<(message: string, options?: unknown) => string>(() => 'toast-id')
}));
vi.mock('svelte-sonner', () => ({
	toast: { dismiss: dismissMock, error: errorMock, success: successMock }
}));

import { DomainError } from '$domain/errors';
import type { RpcClient } from './rpc';
import { offerUndo } from './undo';

interface Button {
	label: string;
	onClick: () => void;
}

function fakeClient(token: string | null, apply = vi.fn(async () => {}), changedNothing = false) {
	return {
		client: {
			undoToken: () => token,
			changedNothing: () => changedNothing,
			api: { undo: { apply } }
		} as unknown as RpcClient,
		apply
	};
}

/** The options of the last success toast. */
function lastOptions(): { action?: Button; cancel?: Button; duration?: number } {
	return successMock.mock.calls.at(-1)?.[1] as ReturnType<typeof lastOptions>;
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

	it('replaces the previous Undo toast, since only the latest write can be taken back', () => {
		dismissMock.mockClear();
		const { client } = fakeClient('7');
		offerUndo(client, Promise.resolve(), 'First');
		offerUndo(client, Promise.resolve(), 'Second');
		expect(dismissMock).toHaveBeenCalledWith('toast-id');
	});

	it('puts Undo second when the toast has its own action', () => {
		successMock.mockClear();
		const { client } = fakeClient('7');
		const reconcile = { label: 'Reconcile', onClick: () => {} };
		offerUndo(client, Promise.resolve(), 'Imported', { action: reconcile });
		expect(lastOptions().action).toBe(reconcile);
		expect(lastOptions().cancel?.label).toBeTruthy();
	});

	it('offers Undo for six seconds, or as long as the toast asks for when longer', () => {
		const { client } = fakeClient('7');
		offerUndo(client, Promise.resolve(), 'Deleted');
		expect(lastOptions().duration).toBe(6000);
		offerUndo(client, Promise.resolve(), 'Imported', { duration: 8000 });
		expect(lastOptions().duration).toBe(8000);
	});

	it('shows the message alone when the write left nothing to undo', () => {
		successMock.mockClear();
		const { client } = fakeClient(null);
		offerUndo(client, Promise.resolve(), 'Deleted');
		expect(lastOptions().action).toBeUndefined();
	});

	it('says nothing when the write changed nothing, and keeps the previous Undo', () => {
		successMock.mockClear();
		dismissMock.mockClear();
		offerUndo(fakeClient('7').client, Promise.resolve(), 'First');
		offerUndo(fakeClient(null, undefined, true).client, Promise.resolve(), 'Assigned');
		expect(successMock).toHaveBeenCalledTimes(1);
		expect(dismissMock).not.toHaveBeenCalled();
	});

	it("still shows a toast's own action when the write changed nothing", () => {
		successMock.mockClear();
		const reconcile = { label: 'Reconcile', onClick: () => {} };
		offerUndo(fakeClient(null, undefined, true).client, Promise.resolve(), 'Imported', {
			action: reconcile
		});
		expect(lastOptions().action).toBe(reconcile);
		expect(lastOptions().cancel).toBeUndefined();
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
