import { describe, expect, it } from 'vitest';
import { msUntilTomorrow } from './today';

describe('msUntilTomorrow', () => {
	it('waits until just past the next local midnight', () => {
		expect(msUntilTomorrow(new Date(2026, 9, 9, 23, 59, 0))).toBe(61_000);
		expect(msUntilTomorrow(new Date(2026, 0, 31, 12, 0, 0))).toBe(12 * 3_600_000 + 1000);
	});
});
