import { describe, expect, it } from 'vitest';
import { RegisterSelection } from './selection.svelte';

describe('RegisterSelection', () => {
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
});
