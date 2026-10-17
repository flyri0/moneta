import { describe, expect, it, vi } from 'vite-plus/test';

import { MobileBack } from './mobile-back';

function setup() {
	const history = { push: vi.fn(), back: vi.fn(), settle: async () => {} };
	const controller = new MobileBack(history);
	controller.setMobile(true);
	return { controller, history };
}

describe('mobile layer history', () => {
	it('unwinds the most recently opened layer and reads the latest callback', async () => {
		const { controller, history } = setup();
		const close = vi.fn();
		const internal = vi.fn();
		controller.register({ close });
		let back: (() => void) | undefined = internal;
		const remove = controller.register({ close: removePicker, back: () => back });
		function removePicker() {
			remove();
		}
		expect(history.push).toHaveBeenCalledTimes(1);
		await controller.pop();
		expect(internal).toHaveBeenCalledOnce();
		back = undefined;
		await controller.pop();
		expect(close).not.toHaveBeenCalled();
		await controller.pop();
		expect(close).toHaveBeenCalledOnce();
	});

	it('consumes a manual close without closing another layer', async () => {
		const { controller, history } = setup();
		const close = vi.fn();
		const remove = controller.register({ close });
		remove();
		expect(history.back).toHaveBeenCalledOnce();
		await controller.pop();
		expect(close).not.toHaveBeenCalled();
		expect(controller.protected).toBe(false);
	});

	it('removes protection on desktop and restores it without closing layers', async () => {
		const { controller, history } = setup();
		const close = vi.fn();
		controller.register({ close });
		controller.setMobile(false);
		await controller.pop();
		expect(close).not.toHaveBeenCalled();
		controller.setMobile(true);
		expect(history.push).toHaveBeenCalledTimes(2);
	});

	it('serializes consecutive transitions and invalidates registrations on navigation', async () => {
		const { controller, history } = setup();
		const close = vi.fn();
		controller.register({ close });
		const done = controller.clear();
		expect(history.back).toHaveBeenCalledOnce();
		await controller.pop();
		await done;
		expect(close).toHaveBeenCalledOnce();
		expect(controller.protected).toBe(false);
	});
	it('ignores another pop while an action is settling', async () => {
		let settle!: () => void;
		const pending = new Promise<void>((resolve) => (settle = resolve));
		const history = { push: vi.fn(), back: vi.fn(), settle: () => pending };
		const controller = new MobileBack(history);
		controller.setMobile(true);
		const back = vi.fn();
		controller.register({ close: vi.fn(), back: () => back });
		const first = controller.pop();
		await controller.pop();
		expect(back).toHaveBeenCalledOnce();
		expect(history.push).toHaveBeenCalledOnce();
		settle();
		await first;
		expect(history.push).toHaveBeenCalledTimes(2);
	});

	it('an unmounted child leaves its parent protected', async () => {
		const { controller, history } = setup();
		const close = vi.fn();
		controller.register({ close });
		const child = controller.register({ close: vi.fn() });
		child();
		expect(history.back).not.toHaveBeenCalled();
		await controller.pop();
		expect(close).toHaveBeenCalledOnce();
	});
});
