import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { pendingLoads, startLoad } from './pending';

describe('startLoad', () => {
	it('counts the loads under way', () => {
		const before = get(pendingLoads);
		const a = startLoad();
		const b = startLoad();
		expect(get(pendingLoads)).toBe(before + 2);
		a();
		expect(get(pendingLoads)).toBe(before + 1);
		b();
		expect(get(pendingLoads)).toBe(before);
	});

	it('ends a load once, however often its end is called', () => {
		const before = get(pendingLoads);
		const end = startLoad();
		const other = startLoad();
		end();
		end();
		expect(get(pendingLoads)).toBe(before + 1);
		other();
		expect(get(pendingLoads)).toBe(before);
	});
});
