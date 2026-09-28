import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGED_MS, RegisterSelection } from './selection.svelte';

describe('RegisterSelection', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('toggles rows and forgets them when it stops', () => {
		const s = new RegisterSelection();
		s.start();
		s.toggle('a');
		s.toggle('b');
		s.toggle('a');
		expect([...s.ids]).toEqual(['b']);
		expect(s.count).toBe(1);
		s.stop();
		expect(s.active).toBe(false);
		expect(s.count).toBe(0);
	});

	it('chooses all listed rows, or none when all were chosen', () => {
		const s = new RegisterSelection();
		s.toggle('a');
		s.toggleAll(['a', 'b', 'c']);
		expect(s.count).toBe(3);
		s.toggleAll(['a', 'b', 'c']);
		expect(s.count).toBe(0);
		s.toggleAll([]);
		expect(s.count).toBe(0);
	});

	it('keeps only rows still listed', () => {
		const s = new RegisterSelection();
		s.toggleAll(['a', 'b', 'c']);
		s.keepOnly(['b', 'x']);
		expect([...s.ids]).toEqual(['b']);
	});

	it('chooses a row without taking it back', () => {
		const s = new RegisterSelection();
		s.select('a');
		s.select('a');
		expect([...s.ids]).toEqual(['a']);
	});

	it('stops when done and marks the changed rows for a moment', () => {
		vi.useFakeTimers();
		const s = new RegisterSelection();
		s.start();
		s.toggleAll(['a', 'b']);
		s.finish(['a', 'b']);
		expect(s.active).toBe(false);
		expect(s.count).toBe(0);
		expect([...s.changed]).toEqual(['a', 'b']);
		vi.advanceTimersByTime(CHANGED_MS);
		expect(s.changed.size).toBe(0);
	});

	it('marks only the latest changed rows', () => {
		vi.useFakeTimers();
		const s = new RegisterSelection();
		s.finish(['a']);
		vi.advanceTimersByTime(CHANGED_MS - 100);
		s.finish(['b']);
		expect([...s.changed]).toEqual(['b']);
		vi.advanceTimersByTime(CHANGED_MS - 100);
		expect([...s.changed]).toEqual(['b']);
		vi.advanceTimersByTime(100);
		expect(s.changed.size).toBe(0);
	});
});
