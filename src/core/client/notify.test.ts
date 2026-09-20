import { describe, expect, it, vi } from 'vitest';

const { errorMock } = vi.hoisted(() => ({ errorMock: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: errorMock } }));

import { DomainError } from '$domain/errors';
import { runActionToast } from './notify';

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
