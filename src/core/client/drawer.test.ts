import { describe, expect, it } from 'vitest';
import { drawerRelease, type DrawerDrag } from './drawer';

const drag = (over: Partial<DrawerDrag>): DrawerDrag => ({
	offset: 0,
	velocity: 0,
	height: 600,
	expanded: false,
	expandable: true,
	...over
});

describe('drawerRelease', () => {
	it('stays put when it barely moved', () => {
		expect(drawerRelease(drag({ offset: 0 }))).toBe('stay');
		expect(drawerRelease(drag({ offset: 6, velocity: 0.8 }))).toBe('stay');
	});

	describe('at its own height', () => {
		it('springs back from a short, slow drag down', () => {
			expect(drawerRelease(drag({ offset: 40, velocity: 0.1 }))).toBe('stay');
		});

		it('closes once dragged down past a quarter of its height', () => {
			expect(drawerRelease(drag({ offset: 160, velocity: 0.1 }))).toBe('close');
		});

		it('closes on a quick flick down, however short', () => {
			expect(drawerRelease(drag({ offset: 30, velocity: 0.8 }))).toBe('close');
		});

		it('fills the screen when dragged or flicked up', () => {
			expect(drawerRelease(drag({ offset: -80, velocity: -0.1 }))).toBe('expand');
			expect(drawerRelease(drag({ offset: -20, velocity: -0.8 }))).toBe('expand');
		});

		it('springs back from a short drag up', () => {
			expect(drawerRelease(drag({ offset: -20, velocity: -0.1 }))).toBe('stay');
		});

		it('never grows when everything already shows', () => {
			expect(drawerRelease(drag({ offset: -200, velocity: -2, expandable: false }))).toBe('stay');
		});
	});

	describe('filling the screen', () => {
		const full = { expanded: true, height: 844 };

		it('goes back to its own height when dragged or flicked down', () => {
			expect(drawerRelease(drag({ ...full, offset: 120, velocity: 0.1 }))).toBe('collapse');
			expect(drawerRelease(drag({ ...full, offset: 20, velocity: 0.8 }))).toBe('collapse');
		});

		it('closes when dragged down past half the screen', () => {
			expect(drawerRelease(drag({ ...full, offset: 500, velocity: 0.1 }))).toBe('close');
		});

		it('stays put when dragged up or nudged', () => {
			expect(drawerRelease(drag({ ...full, offset: -200, velocity: -2 }))).toBe('stay');
			expect(drawerRelease(drag({ ...full, offset: 30, velocity: 0.1 }))).toBe('stay');
		});
	});
});
