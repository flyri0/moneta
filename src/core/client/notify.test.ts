import { describe, expect, it, vi } from 'vitest';

const { errorMock, successMock } = vi.hoisted(() => ({
	errorMock: vi.fn(),
	successMock: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { error: errorMock, success: successMock } }));

import { DomainError } from '$domain/errors';
import { copyDetails, runAction, runActionToast, watchUncaught } from './notify';

describe('runAction', () => {
	it('returns null on success', async () => {
		expect(await runAction(async () => 'ok')).toBeNull();
	});

	it('returns an expected error inline, with no cause and no toast', async () => {
		errorMock.mockClear();
		const error = await runAction(() => {
			throw new DomainError('CATEGORY_REQUIRED');
		});
		expect(error?.message).toBeTruthy();
		expect(error?.cause).toBeUndefined();
		expect(errorMock).not.toHaveBeenCalled();
	});

	it('returns an unexpected error inline with its cause, and no toast', async () => {
		errorMock.mockClear();
		const err = new DomainError('INTERNAL');
		const error = await runAction(() => {
			throw err;
		});
		expect(error?.message).toBeTruthy();
		expect(error?.cause).toBe(err);
		expect(errorMock).not.toHaveBeenCalled();
	});
});

describe('runActionToast', () => {
	it('does not toast on success', async () => {
		errorMock.mockClear();
		await runActionToast(async () => 'ok');
		expect(errorMock).not.toHaveBeenCalled();
	});

	it('toasts an expected error once, with no copy-details action', async () => {
		errorMock.mockClear();
		await runActionToast(() => {
			throw new DomainError('CATEGORY_REQUIRED');
		});
		expect(errorMock).toHaveBeenCalledTimes(1);
		const [, options] = errorMock.mock.calls[0];
		expect(options?.action).toBeUndefined();
	});

	it('toasts an unexpected error once, with a copy-details action', async () => {
		errorMock.mockClear();
		await runActionToast(() => {
			throw new DomainError('INTERNAL');
		});
		expect(errorMock).toHaveBeenCalledTimes(1);
		const [, options] = errorMock.mock.calls[0];
		expect(options?.action?.label).toBeTruthy();
	});
});

describe('copyDetails', () => {
	const err = new DomainError('INTERNAL', 'boom');

	it('says so when the details were copied', async () => {
		errorMock.mockClear();
		successMock.mockClear();
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		await copyDetails(err);
		vi.unstubAllGlobals();
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining('boom'));
		expect(successMock).toHaveBeenCalledTimes(1);
		expect(errorMock).not.toHaveBeenCalled();
	});

	it('says so when the clipboard refuses', async () => {
		errorMock.mockClear();
		successMock.mockClear();
		const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		await expect(copyDetails(err)).resolves.toBeUndefined();
		vi.unstubAllGlobals();
		expect(errorMock).toHaveBeenCalledTimes(1);
		expect(successMock).not.toHaveBeenCalled();
	});

	it('says so when there is no clipboard (an insecure context)', async () => {
		errorMock.mockClear();
		vi.stubGlobal('navigator', {});
		await copyDetails(err);
		vi.unstubAllGlobals();
		expect(errorMock).toHaveBeenCalledTimes(1);
	});
});

describe('watchUncaught', () => {
	function fire(target: EventTarget, type: string, props: Record<string, unknown>) {
		target.dispatchEvent(Object.assign(new Event(type), props));
	}

	it('toasts errors and rejections nothing caught, until stopped', () => {
		errorMock.mockClear();
		const target = new EventTarget();
		const stop = watchUncaught(target);
		fire(target, 'error', { error: new Error('boom'), message: 'boom' });
		fire(target, 'unhandledrejection', { reason: new DomainError('INTERNAL') });
		expect(errorMock).toHaveBeenCalledTimes(2);
		stop();
		fire(target, 'error', { error: new Error('again'), message: 'again' });
		expect(errorMock).toHaveBeenCalledTimes(2);
	});

	it("leaves out the browser's harmless ResizeObserver notices", () => {
		errorMock.mockClear();
		const target = new EventTarget();
		watchUncaught(target);
		fire(target, 'error', {
			error: null,
			message: 'ResizeObserver loop completed with undelivered notifications.'
		});
		expect(errorMock).not.toHaveBeenCalled();
	});
});
